"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Contact } from "@/lib/database.types";
import toast from "react-hot-toast";

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "bg-coral-50", text: "text-coral-700" },
  MED:  { bg: "bg-gold-50",  text: "text-gold-700"  },
  LOW:  { bg: "bg-navy-50",  text: "text-navy-600"  },
};

const STAGE_BADGE: Record<string, string> = {
  Marketing: "bg-blue-50 text-blue-700",
  Processing: "bg-amber-50 text-amber-700",
  "In Contract": "bg-emerald-50 text-emerald-700",
  Other: "bg-slate-100 text-slate-600",
};

// "All" sentinel for the campaign filter
const ALL = "__ALL__";
const UNTAGGED = "__UNTAGGED__";

export default function ContactsView({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("name");

    if (error) toast.error("Failed to load contacts");
    else setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Build a {campaign -> count} map from the loaded contacts.
  // Untagged (null/empty) get bucketed under UNTAGGED.
  const campaignCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) {
      const key = c.campaign && c.campaign.trim() !== "" ? c.campaign.trim() : UNTAGGED;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [contacts]);

  // Sorted list of campaign chips: All first, then real campaigns by count desc, Untagged last.
  const campaignChips = useMemo(() => {
    const real = Array.from(campaignCounts.entries())
      .filter(([k]) => k !== UNTAGGED)
      .sort((a, b) => b[1] - a[1]); // by count desc

    const untagged = campaignCounts.get(UNTAGGED) || 0;

    const chips: { key: string; label: string; count: number }[] = [
      { key: ALL, label: "All", count: contacts.length },
      ...real.map(([k, v]) => ({ key: k, label: k, count: v })),
    ];
    if (untagged > 0) chips.push({ key: UNTAGGED, label: "Untagged", count: untagged });
    return chips;
  }, [campaignCounts, contacts.length]);

  // Apply campaign filter, then search
  const filtered = useMemo(() => {
    let list = contacts;

    if (campaignFilter === UNTAGGED) {
      list = list.filter(c => !c.campaign || c.campaign.trim() === "");
    } else if (campaignFilter !== ALL) {
      list = list.filter(c => (c.campaign || "").trim() === campaignFilter);
    }

    if (search.trim() !== "") {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.first_name || "").toLowerCase().includes(q) ||
        (c.last_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.state || "").toLowerCase().includes(q) ||
        (c.campaign || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [contacts, campaignFilter, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-slate-100">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search name, phone, email, city, campaign…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Campaign filter chips — horizontal scroll */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {campaignChips.map((chip) => {
            const active = campaignFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setCampaignFilter(chip.key)}
                className={
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
                  (active
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                }
              >
                {chip.label}
                <span className={
                  "ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] " +
                  (active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")
                }>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-2">
          {filtered.length} of {contacts.length} contacts
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-touch">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">
              {search || campaignFilter !== ALL
                ? "No contacts match your filter"
                : "No contacts yet. Import a CSV to get started."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const priority = c.priority_score
                ? PRIORITY_STYLE[c.priority_score]
                : null;
              return (
                <li
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(c.first_name?.[0] || c.name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unnamed"}
                      </p>
                      {priority && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priority.bg} ${priority.text}`}>
                          {c.priority_score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.campaign && (
                        <span className="text-xs text-slate-500 truncate">{c.campaign}</span>
                      )}
                      {c.pipeline_stage && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STAGE_BADGE[c.pipeline_stage] || STAGE_BADGE.Other}`}>
                          {c.pipeline_stage}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100"
                    >
                      📞
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
