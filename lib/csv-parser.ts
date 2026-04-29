import Papa from "papaparse";
import { Contact, PipelineStage, PriorityScore } from "./database.types";

export interface ParsedContact {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  pipeline_stage: PipelineStage;
  campaign: string | null;
  status: string | null;
  priority_score: PriorityScore;
  credit_score: string | null;
  equity_flag: boolean | null;
  mortgage_amount: string | null;
  year_purchased: string | null;
  notes: string | null;
  next_steps: string | null;
  response_received: boolean;
}

export interface ParseResult {
  valid: ParsedContact[];
  errors: string[];
  duplicates: number;
  format: "absentee_owner" | "market_leader" | "generic";
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

function cleanPhone(p: string): string | null {
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}

function parsePriority(val: string): PriorityScore {
  const v = val.trim().toUpperCase();
  if (v === "HIGH") return "HIGH";
  if (v === "MED" || v === "MEDIUM") return "MED";
  if (v === "LOW") return "LOW";
  return null;
}

function mapStatusToPipeline(status: string | null): PipelineStage {
  if (!status) return "Other";
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("new") || s.includes("prospect") || s.includes("not started")) return "Marketing";
  if (s.includes("process") || s.includes("appoint") || s.includes("showing")) return "Processing";
  if (s.includes("contract") || s.includes("pending") || s.includes("closing")) return "In Contract";
  return "Other";
}

function detectFormat(headers: string[]): "absentee_owner" | "market_leader" | "generic" {
  const h = headers.map(normalize).join(" ");
  if (h.includes("priority score") || h.includes("equity flag") || h.includes("credit score") || h.includes("touch 1")) {
    return "absentee_owner";
  }
  if (h.includes("campaign name") || h.includes("lead status")) {
    return "market_leader";
  }
  return "generic";
}

function findCol(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    for (const [col, val] of Object.entries(row)) {
      if (normalize(col) === key || normalize(col).includes(key)) {
        return val || "";
      }
    }
  }
  return "";
}

function parseAbsenteeOwner(rows: Record<string, string>[]): ParseResult {
  const valid: ParsedContact[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = findCol(row, "first name", "first");
    const lastName = findCol(row, "last name", "last");
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!name) { errors.push(`Row ${i + 2}: No name, skipped`); continue; }

    const phone = cleanPhone(
      findCol(row, "cell phone", "phone", "mobile") ||
      findCol(row, "home phone")
    );
    const email = findCol(row, "email address", "email") || null;
    const dedupeKey = (email?.toLowerCase() || phone || name.toLowerCase());
    if (seen.has(dedupeKey)) { duplicates++; continue; }
    seen.add(dedupeKey);

    const status = findCol(row, "status") || null;
    const nextStep = findCol(row, "notes next step", "notes / next step", "next step") || null;
    const responseRaw = findCol(row, "response received");

    valid.push({
      name,
      phone: phone ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}` : null,
      email: email?.toLowerCase() || null,
      address: findCol(row, "address 1", "address") || null,
      city: findCol(row, "city") || null,
      state: findCol(row, "state", "st") || null,
      zip: findCol(row, "zip") || null,
      pipeline_stage: mapStatusToPipeline(status),
      campaign: null,
      status,
      priority_score: parsePriority(findCol(row, "priority score")),
      credit_score: findCol(row, "credit score", "credit rating") || null,
      equity_flag: findCol(row, "equity flag").toLowerCase() === "true" ? true :
                   findCol(row, "equity flag").toLowerCase() === "false" ? false : null,
      mortgage_amount: findCol(row, "mortgage amount", "1st mortgage amount") || null,
      year_purchased: findCol(row, "year purchased", "mortgage year", "sale date") || null,
      notes: null,
      next_steps: nextStep,
      response_received: ["yes", "true", "1"].includes(responseRaw.toLowerCase()),
    });
  }

  return { valid, errors, duplicates, format: "absentee_owner" };
}

function parseMarketLeader(rows: Record<string, string>[]): ParseResult {
  const valid: ParsedContact[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = findCol(row, "name", "full name") ||
      [findCol(row, "first name"), findCol(row, "last name")].filter(Boolean).join(" ");

    if (!name.trim()) { errors.push(`Row ${i + 2}: No name, skipped`); continue; }

    const phone = cleanPhone(findCol(row, "phone", "mobile phone", "phone number"));
    const email = findCol(row, "email", "email address") || null;
    const dedupeKey = email?.toLowerCase() || phone || name.toLowerCase();
    if (seen.has(dedupeKey)) { duplicates++; continue; }
    seen.add(dedupeKey);

    const status = findCol(row, "status", "lead status") || null;
    const campaign = findCol(row, "campaign name", "campaign") || null;
    const notes = findCol(row, "notes", "note") || null;

    valid.push({
      name: name.trim(),
      phone: phone ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}` : null,
      email: email?.toLowerCase() || null,
      address: null, city: null, state: null, zip: null,
      pipeline_stage: mapStatusToPipeline(status),
      campaign, status,
      priority_score: null,
      credit_score: null, equity_flag: null,
      mortgage_amount: null, year_purchased: null,
      notes, next_steps: null,
      response_received: false,
    });
  }

  return { valid, errors, duplicates, format: "market_leader" };
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (!rows.length) {
          resolve({ valid: [], errors: ["CSV is empty"], duplicates: 0, format: "generic" });
          return;
        }

        // Filter out section header rows (like "SEGMENT B - Out-of-State...")
        const dataRows = rows.filter(row => {
          const firstVal = Object.values(row)[0] || "";
          return !firstVal.toLowerCase().includes("segment") && firstVal !== "First Name";
        });

        const headers = Object.keys(rows[0]);
        const format = detectFormat(headers);

        if (format === "absentee_owner") {
          resolve(parseAbsenteeOwner(dataRows));
        } else if (format === "market_leader") {
          resolve(parseMarketLeader(dataRows));
        } else {
          resolve(parseMarketLeader(dataRows)); // fallback
        }
      },
      error: (err) => resolve({ valid: [], errors: [err.message], duplicates: 0, format: "generic" }),
    });
  });
}
