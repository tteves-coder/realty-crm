"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Contact } from "@/lib/database.types";
import { format } from "date-fns";
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

type ViewMode = "all" | "ml_update";

export default function ContactsView({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contacts").select("*").eq("user_id", userId).order("name");
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Filter contacts
  const base = viewMode === "ml_update"
    ? contacts.filter(c => (c as any).ml_update_needed)
    : contacts;

  const filtered = base.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.campaign || "").toLowerCase().includes(search.toLowerCase())
  );

  const mlUpdateCount = contacts.filter(c => (c as any).ml_update_needed).length;

  // Delete single contact
  const deleteContact = async (contact: Contact) => {
    setDeleting(true);
    // Delete tasks first (cascades should handle it but let's be safe)
    await supabase.from("tasks").delete().eq("contact_id", contact.id);
    await supabase.from("touch_logs").delete().eq("contact_id", contact.id);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      toast.success(`${contact.name} deleted`);
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  // Delete selected contacts
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await supabase.from("tasks").delete().in("contact_id", ids);
    await supabase.from("touch_logs").delete().in("contact_id", ids);
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      toast.success(`${ids.length} contacts deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
    setDeleting(false);
  };

  // Export contacts to CSV
  const handleExport = async (exportContacts: Contact[], filename: string) => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const headers = [
        "Name", "Phone", "Email", "Address", "City", "State", "ZIP",
        "Pipeline Stage", "Campaign", "Priority", "Credit Score",
        "Equity Flag", "Mortgage Amount", "Year Purchased",
        "Next Steps", "Notes", "Last Contacted", "ML Update Needed",
        "Response Received",
      ];
      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = exportContacts.map((c: any) => [
        c.name, c.phone, c.email, c.address, c.city, c.state, c.zip,
        c.pipeline_stage, c.campaign, c.priority_score, c.credit_score,
        c.equity_flag, c.mortgage_amount, c.year_purchased,
        c.next_steps, c.notes, c.last_contacted, c.ml_update_needed,
        c.response_received,
      ].map(escape).join(","));

      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const byPriority = ["HIGH", "MED", "LOW", null].reduce((acc, p) => {
    const key = p || "None";
    acc[key] = filtered.filter(c => c.priority_score === p);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-navy-100 space-y-2">
        {/* View toggle */}
        <div className="flex gap-2">
          <button onClick={() => setViewMode("all")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === "all" ? "text-white" : "bg-navy-50 text-navy-500"}`}
            style={viewMode === "all" ? { background: "linear-gradient(135deg, #1e1f6b, #6171f5)" } : {}}>
            All ({contacts.length})
          </button>
          <button onClick={() => setViewMode("ml_update")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${viewMode === "ml_update" ? "text-white" : "bg-gold-50 text-gold-700"}`}
            style={viewMode === "ml_update" ? { background: "linear-gradient(135deg, #d97706, #f59e0b)" } : {}}>
            🔔 Update ML ({mlUpdateCount})
          </button>
        </div>

        {/* Search + actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-navy-50 border border-navy-100 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-300" />
          </div>

          {/* Select mode toggle */}
          <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectMode ? "border-coral-400 bg-coral-50 text-coral-700" : "border-navy-100 text-navy-600"}`}>
            {selectMode ? "Cancel" : "Select"}
          </button>

          {/* Export button */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting}
              className="h-9 px-3 rounded-xl border-2 border-navy-100 text-navy-700 font-bold text-xs flex items-center gap-1 hover:border-navy-300 transition-colors">
              {exporting ? (
                <div className="w-3 h-3 border-2 border-navy-300 border-t-navy-600 rounded-full animate-spin" />
              ) : "↓ CSV"}
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-11 z-20 bg-white rounded-2xl shadow-card-lg border border-navy-100 py-2 min-w-[200px]">
                  <p className="px-4 py-1 text-xs text-navy-400 font-semibold uppercase tracking-wide">Export</p>
                  <button onClick={() => handleExport(filtered, `contacts-${format(new Date(), "yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 font-medium">
                    Current view ({filtered.length})
                  </button>
                  <button onClick={() => handleExport(contacts.filter(c => (c as any).ml_update_needed), `ml-update-${format(new Date(), "yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gold-700 hover:bg-gold-50 font-medium">
                    🔔 ML Update flagged ({mlUpdateCount})
                  </button>
                  <button onClick={() => handleExport(contacts, `all-contacts-${format(new Date(), "yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 font-medium">
                    All contacts ({contacts.length})
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => handleExport(contacts.filter(c => selectedIds.has(c.id)), `selected-${format(new Date(), "yyyy-MM-dd")}.csv`)}
                      className="w-full text-left px-4 py-2.5 text-sm text-jade-700 hover:bg-jade-50 font-medium">
                      ✓ Selected ({selectedIds.size})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Select mode actions */}
        {selectMode && (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set(filtered.map(c => c.id)))}
              className="text-xs text-navy-500 font-medium hover:text-navy-800">
              Select all ({filtered.length})
            </button>
            <span className="text-navy-200">·</span>
            <span className="text-xs text-navy-400">{selectedIds.size} selected</span>
            {selectedIds.size > 0 && (
              <>
                <span className="text-navy-200">·</span>
                <button onClick={deleteSelected} disabled={deleting}
                  className="text-xs text-coral-600 font-bold hover:text-coral-800">
                  {deleting ? "Deleting..." : `Delete ${selectedIds.size}`}
                </button>
                <button onClick={() => handleExport(contacts.filter(c => selectedIds.has(c.id)), `selected-${format(new Date(), "yyyy-MM-dd")}.csv`)}
                  className="text-xs text-jade-700 font-bold hover:text-jade-900">
                  Export {selectedIds.size}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-navy-400 font-medium">{filtered.length} contacts</p>
      </div>

      {/* ML Update banner */}
      {viewMode === "ml_update" && mlUpdateCount > 0 && (
        <div className="mx-4 mt-3 p-3 bg-gold-50 border border-gold-200 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gold-800">🔔 {mlUpdateCount} contacts flagged</p>
            <p className="text-xs text-gold-600 mt-0.5">These contacts need updating in Market Leader</p>
          </div>
          <button onClick={() => handleExport(contacts.filter(c => (c as any).ml_update_needed), `ml-update-${format(new Date(), "yyyy-MM-dd")}.csv`)}
            className="text-xs font-bold text-gold-700 bg-gold-100 border border-gold-300 px-3 py-1.5 rounded-xl">
            Export CSV
          </button>
        </div>
      )}

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto scroll-touch">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-navy-400 text-sm">
              {viewMode === "ml_update" ? "No contacts flagged for ML update" : "No contacts found"}
            </p>
          </div>
        ) : (
          <>
            {["HIGH", "MED", "LOW", "None"].map(p => {
              const group = byPriority[p];
              if (!group?.length) return null;
              return (
                <div key={p}>
                  <div className="px-4 py-2 bg-navy-50/50 border-b border-navy-100">
                    <p className="section-title">{p === "None" ? "No Priority" : `${p} Priority`} · {group.length}</p>
                  </div>
                  {group.map(c => (
                    <div key={c.id} className="flex items-center bg-white border-b border-navy-50">
                      {/* Checkbox in select mode */}
                      {selectMode && (
                        <button onClick={() => toggleSelect(c.id)} className="pl-4 pr-2 py-3.5">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.has(c.id) ? "border-navy-600 bg-navy-600" : "border-navy-300"}`}>
                            {selectedIds.has(c.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                              </svg>
                            )}
                          </div>
                        </button>
                      )}

                      {/* Contact row */}
                      <button className="flex-1 text-left px-4 py-3.5 hover:bg-navy-50/50 active:bg-navy-50 transition-colors"
                        onClick={() => selectMode ? toggleSelect(c.id) : router.push(`/contacts/${c.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-display font-bold flex-shrink-0 relative"
                            style={{ background: STAGE_GRAD[c.pipeline_stage] || STAGE_GRAD.Other }}>
                            {c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                            {(c as any).ml_update_needed && (
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gold-400 rounded-full border-2 border-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-display font-semibold text-navy-900 text-sm">{c.name}</p>
                              {c.priority_score && (
                                <span className={`badge ${PRIORITY_STYLE[c.priority_score]?.bg} ${PRIORITY_STYLE[c.priority_score]?.text}`}>
                                  {c.priority_score}
                                </span>
                              )}
                              {(c as any).ml_update_needed && (
                                <span className="badge bg-gold-50 text-gold-700">🔔 ML</span>
                              )}
                            </div>
                            <p className="text-xs text-navy-400 mt-0.5 truncate">
                              {[c.city, c.credit_score, c.campaign || c.phone].filter(Boolean).join(" · ")}
                            </p>
                            {(c as any).next_steps && (
                              <p className="text-xs text-navy-500 mt-0.5 truncate">→ {(c as any).next_steps}</p>
                            )}
                          </div>
                          {!selectMode && (
                            <svg className="w-4 h-4 text-navy-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* Delete button (non-select mode) */}
                      {!selectMode && (
                        <button onClick={() => setDeleteTarget(c)}
                          className="pr-4 pl-2 py-3.5 text-navy-300 hover:text-coral-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 safe-bottom">
            <h3 className="font-display font-bold text-navy-900 text-lg mb-1">Delete contact?</h3>
            <p className="text-navy-500 text-sm mb-1">
              <span className="font-semibold">{deleteTarget.name}</span> will be permanently deleted
              along with all their tasks and touch history.
            </p>
            <p className="text-coral-600 text-xs mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => deleteContact(deleteTarget)} disabled={deleting}
                className="flex-1 py-3 rounded-2xl font-display font-bold text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #dc2626, #f87171)" }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
