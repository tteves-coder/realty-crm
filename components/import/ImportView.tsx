"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { parseCSV, ParsedContact } from "@/lib/csv-parser";
import toast from "react-hot-toast";

type State = "idle" | "parsing" | "preview" | "importing" | "done";

const FORMAT_INFO: Record<string, { label: string; color: string; desc: string }> = {
  absentee_owner: { label: "Absentee Owner Tracker", color: "#6171f5", desc: "Detected your Absentee Owner spreadsheet format — will import Priority Score, Credit Score, Equity Flag, and Mortgage data." },
  market_leader:  { label: "Market Leader Export",   color: "#10b981", desc: "Detected Market Leader format — will import Campaign, Status, and Notes." },
  generic:        { label: "Generic CSV",             color: "#f59e0b", desc: "Generic format detected — will import Name, Phone, Email." },
};

export default function ImportView({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("idle");
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dupes, setDupes] = useState(0);
  const [format, setFormat] = useState<string>("generic");
  const [imported, setImported] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a CSV file"); return; }
    setState("parsing");
    const result = await parseCSV(file);
    setParsed(result.valid);
    setErrors(result.errors);
    setDupes(result.duplicates);
    setFormat(result.format);
    setState("preview");
  };

  const handleImport = async () => {
    setState("importing");
    let count = 0;
    for (const contact of parsed) {
      const { error } = await supabase.from("contacts").insert({
        user_id: userId, ...contact,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ml_update_needed: false, response_received: contact.response_received || false,
      } as any);
      if (!error) count++;
    }
    setImported(count);
    setState("done");
    toast.success(`Imported ${count} contacts!`);
  };

  const reset = () => {
    setState("idle"); setParsed([]); setErrors([]); setDupes(0); setImported(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const fmtInfo = FORMAT_INFO[format] || FORMAT_INFO.generic;

  return (
    <div className="h-full overflow-y-auto scroll-touch">
      <div className="max-w-lg mx-auto px-4 py-4">

        {state === "done" && (
          <div className="card p-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-display font-bold text-navy-900 text-xl">Import Complete!</h3>
            <p className="text-navy-600 mt-2">{imported} contacts imported</p>
            <button onClick={reset} className="btn-primary mt-6 w-full">Import Another File</button>
          </div>
        )}

        {state === "preview" && (
          <div className="space-y-3">
            {/* Format detected */}
            <div className="card p-4" style={{ borderColor: fmtInfo.color, borderWidth: 2 }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: fmtInfo.color }} />
                <p className="font-display font-semibold text-navy-900 text-sm">{fmtInfo.label}</p>
              </div>
              <p className="text-xs text-navy-500">{fmtInfo.desc}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "To Import", val: parsed.length, color: "#6171f5" },
                { label: "Duplicates", val: dupes, color: "#f59e0b" },
                { label: "Errors", val: errors.length, color: "#f94021" },
              ].map(s => (
                <div key={s.label} className="card p-3 text-center">
                  <p className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-xs text-navy-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <div className="bg-coral-50 rounded-2xl p-3 border border-coral-100">
                <p className="text-xs font-semibold text-coral-700 mb-1">Issues:</p>
                {errors.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-coral-600">{e}</p>)}
                {errors.length > 3 && <p className="text-xs text-coral-400 mt-1">+{errors.length - 3} more</p>}
              </div>
            )}

            {/* Preview */}
            {parsed.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-navy-100">
                  <p className="text-sm font-display font-semibold text-navy-700">Preview (first 5)</p>
                </div>
                {parsed.slice(0, 5).map((c, i) => (
                  <div key={i} className="px-4 py-3 border-b border-navy-50 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-display font-semibold text-navy-900 text-sm">{c.name}</p>
                        <p className="text-xs text-navy-400 mt-0.5">{[c.city, c.phone].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="text-right">
                        {c.priority_score && <p className="text-xs font-bold" style={{ color: c.priority_score === "HIGH" ? "#f94021" : c.priority_score === "MED" ? "#f59e0b" : "#6171f5" }}>{c.priority_score}</p>}
                        {c.credit_score && <p className="text-xs text-navy-400">{c.credit_score}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {parsed.length > 5 && <div className="px-4 py-2 text-xs text-navy-400 text-center">+{parsed.length - 5} more</div>}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary flex-1">Cancel</button>
              {parsed.length > 0 && (
                <button onClick={handleImport} className="btn-primary flex-1">Import {parsed.length}</button>
              )}
            </div>
          </div>
        )}

        {(state === "idle" || state === "parsing") && (
          <div className="space-y-3">
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-navy-200 rounded-3xl p-8 text-center cursor-pointer hover:border-navy-400 hover:bg-navy-50/50 transition-all">
              {state === "parsing" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
                  <p className="text-sm text-navy-500">Detecting format...</p>
                </div>
              ) : (
                <>
                  <div className="text-5xl mb-3">📥</div>
                  <p className="font-display font-bold text-navy-900">Upload CSV File</p>
                  <p className="text-sm text-navy-400 mt-1">Tap to browse or drag & drop</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {/* Supported formats */}
            <div className="card p-4">
              <p className="section-title mb-3">Supported Formats</p>
              <div className="space-y-3">
                {Object.entries(FORMAT_INFO).map(([key, info]) => (
                  <div key={key} className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: info.color }} />
                    <div>
                      <p className="text-sm font-semibold text-navy-800">{info.label}</p>
                      <p className="text-xs text-navy-400 mt-0.5">{info.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === "importing" && (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-display font-bold text-navy-900">Importing contacts...</p>
            <p className="text-sm text-navy-400 mt-1">Please don't close this page</p>
          </div>
        )}
      </div>
    </div>
  );
}
