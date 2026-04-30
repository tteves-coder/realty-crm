"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Contact } from "@/lib/database.types";
import toast from "react-hot-toast";

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "bg-coral-50", text: "text-coral-700" },
  MED:  { bg: "bg-gold-50",  text: "text-gold-700"  },
  LOW:  { bg: "bg-navy-50",  text: "text-navy-600"  },
};

const STAGE_GRAD: Record<string, string> = {
  Marketing: "linear-gradient(135deg, #6171f5, #8196fa)",
  Processing: "linear-gradient(135deg, #f59e0b, #fcd34d)",
  "In Contract": "linear-gradient(135deg, #10b981, #34d399)",
  Other: "linear-gradient(135deg, #64748b, #94a3b8)",
};

export default function ContactsView({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from("contacts").select("*").eq("user_id", userId).order("name");
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.campaign || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (filter?: string) => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const url = `/api/export${filter ? `?filter=${filter}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `contacts-${new Date().toISOString().split("T")[0]}${filter ? `-${filter}` : ""}.csv`;
      a.click();
      toast.success("CSV downloaded!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const byPriority = ["HIGH", "MED", "LOW", null].reduce((acc, p) => {
    const key = p || "None";
    acc[key] = filtered.filter(c => c.priority_score === p);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Search + Export bar */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-navy-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" placeholder="Search contacts..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 border border-navy-100 rounded-2xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-300" />
          </div>

          {/* Export button */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting}
              className="h-10 px-3 rounded-2xl border-2 border-navy-100 text-navy-700 font-semibold text-sm flex items-center gap-1.5 hover:border-navy-300 transition-colors">
              {exporting ? (
                <div className="w-4 h-4 border-2 border-navy-300 border-t-navy-600 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              CSV
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-12 z-20 bg-white rounded-2xl shadow-card-lg border border-navy-100 py-2 min-w-[200px]">
                  <p className="px-4 py-1 text-xs text-navy-400 font-semibold">Export contacts</p>
                  {[
                    { label: "All contacts", filter: undefined },
                    { label: "ML update flagged", filter: "ml_update" },
                    { label: "Not contacted 30+ days", filter: "needs_update" },
                    { label: "Missing email", filter: "no_email" },
                  ].map(opt => (
                    <button key={opt.label} onClick={() => handleExport(opt.filter)}
                      className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 font-medium">
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2 font-medium">{filtered.length} contacts · tap to open</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-navy-400 text-sm">No contacts found</p></div>
        ) : (
          <>
            {["HIGH", "MED", "LOW", "None"].map(p => {
              const group = byPriority[p];
              if (!group?.length) return null;
              return (
                <div key={p}>
                  <div className="px-4 py-2 bg-navy-50/50">
                    <p className="section-title">{p === "None" ? "No Priority" : `${p} Priority`} · {group.length}</p>
                  </div>
                  {group.map(c => (
                    <button key={c.id} onClick={() => router.push(`/contacts/${c.id}`)}
                      className="w-full text-left px-4 py-3.5 bg-white border-b border-navy-50 hover:bg-navy-50/50 active:bg-navy-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-display font-bold flex-shrink-0"
                          style={{ background: STAGE_GRAD[c.pipeline_stage] || STAGE_GRAD.Other }}>
                          {c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display font-semibold text-navy-900 text-sm">{c.name}</p>
                            {c.priority_score && (
                              <span className={`badge ${PRIORITY_STYLE[c.priority_score]?.bg} ${PRIORITY_STYLE[c.priority_score]?.text}`}>
                                {c.priority_score}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-navy-400 mt-0.5 truncate">
                            {[c.city, c.credit_score, c.campaign || c.phone].filter(Boolean).join(" · ")}
                          </p>
                          {c.next_steps && (
                            <p className="text-xs text-navy-600 mt-0.5 truncate">→ {c.next_steps}</p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-navy-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
