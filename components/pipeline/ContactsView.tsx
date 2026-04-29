"use client";
import { useEffect, useState, useCallback } from "react";
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

export default function ContactsView({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
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

  const byPriority = ["HIGH", "MED", "LOW", null].reduce((acc, p) => {
    const key = p || "None";
    acc[key] = filtered.filter(c => c.priority_score === p);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2 bg-white border-b border-navy-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="search" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-navy-50 border border-navy-100 rounded-2xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-300" />
        </div>
        <p className="text-xs text-navy-400 mt-2 font-medium">{filtered.length} contacts</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>
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
                    <button key={c.id} onClick={() => setSelected(c)}
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

      {selected && <ContactDetail contact={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ContactDetail({ contact: c, onClose }: { contact: Contact; onClose: () => void }) {
  const initials = c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl safe-bottom max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-navy-200" /></div>
        <div className="px-4 pb-4 border-b border-navy-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-lg"
                style={{ background: STAGE_GRAD[c.pipeline_stage] || STAGE_GRAD.Other }}>{initials}</div>
              <div>
                <h3 className="font-display font-bold text-navy-900">{c.name}</h3>
                <p className="text-xs text-navy-400">{[c.city, c.state].filter(Boolean).join(", ")} · {c.pipeline_stage}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          {/* Property grid */}
          <div className="grid grid-cols-3 gap-2">
            {c.credit_score && <div className="bg-navy-50 rounded-xl p-2.5 text-center"><p className="text-xs text-navy-400">Credit</p><p className="text-sm font-bold text-navy-800">{c.credit_score}</p></div>}
            {c.equity_flag !== null && <div className={`rounded-xl p-2.5 text-center ${c.equity_flag ? "bg-jade-50" : "bg-coral-50"}`}><p className="text-xs text-navy-400">Equity</p><p className={`text-sm font-bold ${c.equity_flag ? "text-jade-700" : "text-coral-700"}`}>{c.equity_flag ? "YES" : "NO"}</p></div>}
            {c.mortgage_amount && <div className="bg-gold-50 rounded-xl p-2.5 text-center"><p className="text-xs text-navy-400">Mortgage</p><p className="text-sm font-bold text-gold-800 truncate">{c.mortgage_amount}</p></div>}
          </div>
          {/* Contact actions */}
          <div className="grid grid-cols-3 gap-2">
            {c.phone && <a href={`tel:${c.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #6171f5, #8196fa)" }}><span className="text-xl">📞</span>Call</a>}
            {c.phone && <a href={`sms:${c.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}><span className="text-xl">💬</span>Text</a>}
            {c.email && <a href={`mailto:${c.email}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}><span className="text-xl">📧</span>Email</a>}
          </div>
          {/* Details */}
          {c.address && <div className="p-3 bg-navy-50 rounded-xl text-sm text-navy-700">{[c.address, c.city, c.state, c.zip].filter(Boolean).join(", ")}</div>}
          {c.next_steps && <div><p className="section-title mb-1">Next Steps</p><div className="p-3 bg-jade-50 rounded-xl text-sm text-jade-800">{c.next_steps}</div></div>}
          {c.notes && <div><p className="section-title mb-1">Notes</p><div className="p-3 bg-navy-50 rounded-xl text-sm text-navy-700">{c.notes}</div></div>}
          <div className="text-xs text-navy-300 text-center">Added {format(new Date(c.created_at), "MMM d, yyyy")}</div>
        </div>
      </div>
    </>
  );
}
