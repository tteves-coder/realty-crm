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

  const deleteContact = async (contact: Contact) => {
    setDeleting(true);
    await supabase.from("tasks").delete().eq("contact_id", contact.id);
    await supabase.from("touch_logs").delete().eq("contact_id", contact.id);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) { toast.error("Failed to delete"); }
    else { setContacts(prev => prev.filter(c => c.id !== contact.id)); toast.success(`${contact.name} deleted`); }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await supabase.from("tasks").delete().in("contact_id", ids);
    await supabase.from("touch_logs").delete().in("contact_id", ids);
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (error) { toast.error("Failed to delete"); }
    else {
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      toast.success(`${ids.length} contacts deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
    setDeleting(false);
  };

  const handleExport = async (exportContacts: Contact[], filename: string) => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const headers = [
        "Name","Phone","Email","Address","City","State","ZIP",
        "Pipeline Stage","Campaign","Priority","Credit Score",
        "Equity Flag","Mortgage Amount","Year Purchased",
        "Next Steps","Notes","Last Contacted","ML Update Needed","Response Received",
      ];
      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s;
      };
      const rows = exportContacts.map((c: any) => [
        c.name,c.phone,c.email,c.address,c.city,c.state,c.zip,
        c.pipeline_stage,c.campaign,c.priority_score,c.credit_score,
        c.equity_flag,c.mortgage_amount,c.year_purchased,
        c.next_steps,c.notes,c.last_contacted,c.ml_update_needed,c.response_received,
      ].map(escape).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded!");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const byPriority = ["HIGH","MED","LOW",null].reduce((acc, p) => {
    acc[p || "None"] = filtered.filter(c => c.priority_score === p);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2 bg-white border-b border-navy-100 space-y-2">
        {/* View toggle */}
        <div className="flex gap-2">
          <button onClick={() => setViewMode("all")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === "all" ? "text-white" : "bg-navy-50 text-navy-500"}`}
            style={viewMode === "all" ? { background: "linear-gradient(135deg, #1e1f6b, #6171f5)" } : {}}>
            All ({contacts.length})
          </button>
          <button onClick={() => setViewMode("ml_update")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === "ml_update" ? "text-white" : "bg-gold-50 text-gold-700"}`}
            style={viewMode === "ml_update" ? { background: "linear-gradient(135deg, #d97706, #f59e0b)" } : {}}>
            🔔 Update ML ({mlUpdateCount})
          </button>
        </div>

        {/* Search + actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="search" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-navy-50 border border-navy-100 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-300"/>
          </div>
          <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectMode ? "border-coral-400 bg-coral-50 text-coral-700" : "border-navy-100 text-navy-600"}`}>
            {selectMode ? "Cancel" : "Select"}
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting}
              className="h-9 px-3 rounded-xl border-2 border-navy-100 text-navy-700 font-bold text-xs flex items-center gap-1 hover:border-navy-300 transition-colors">
              {exporting ? <div className="w-3 h-3 border-2 border-navy-300 border-t-navy-600 rounded-full animate-spin"/> : "↓ CSV"}
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}/>
                <div className="absolute right-0 top-11 z-20 bg-white rounded-2xl shadow-card-lg border border-navy-100 py-2 min-w-[200px]">
                  <p className="px-4 py-1 text-xs text-navy-400 font-semibold uppercase tracking-wide">Export</p>
                  <button onClick={() => handleExport(filtered, `contacts-${format(new Date(),"yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 font-medium">
                    Current view ({filtered.length})
                  </button>
                  <button onClick={() => handleExport(contacts.filter(c => (c as any).ml_update_needed), `ml-update-${format(new Date(),"yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gold-700 hover:bg-gold-50 font-medium">
                    🔔 ML Update flagged ({mlUpdateCount})
                  </button>
                  <button onClick={() => handleExport(contacts, `all-contacts-${format(new Date(),"yyyy-MM-dd")}.csv`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 font-medium">
                    All contacts ({contacts.length})
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => handleExport(contacts.filter(c => selectedIds.has(c.id)), `selected-${format(new Date(),"yyyy-MM-dd")}.csv`)}
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
          <div className="flex items-center gap-2 flex-wrap">
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
                  {deleting ? "Deleting..." : `Delete ${selectedId
