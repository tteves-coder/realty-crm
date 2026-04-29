"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Contact, TouchType } from "@/lib/database.types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRIORITY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  HIGH: { bg: "bg-coral-50", text: "text-coral-700", dot: "bg-coral-500" },
  MED:  { bg: "bg-gold-50",  text: "text-gold-700",  dot: "bg-gold-500"  },
  LOW:  { bg: "bg-navy-50",  text: "text-navy-600",  dot: "bg-navy-400"  },
};

const TOUCH_TYPES: { type: TouchType; label: string; emoji: string; color: string }[] = [
  { type: "call",      label: "Called",    emoji: "📞", color: "#6171f5" },
  { type: "text",      label: "Texted",    emoji: "💬", color: "#10b981" },
  { type: "email",     label: "Emailed",   emoji: "📧", color: "#8b5cf6" },
  { type: "door",      label: "Door Knock",emoji: "🚪", color: "#f59e0b" },
  { type: "postcard",  label: "Postcard",  emoji: "📮", color: "#f94021" },
  { type: "bombbomb",  label: "BombBomb",  emoji: "🎥", color: "#ec4899" },
];

const ALL_CAMPAIGNS = ["8x8 Buyer", "Seller Nurture", "Past Client", "Absentee Owner", "Other"];
const ALL_STAGES = ["Marketing", "Processing", "In Contract", "Other"];

export default function PriorityList({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [filter, setFilter] = useState<"due" | "all">("due");
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchContacts = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: taskData } = await supabase.from("tasks")
      .select("contact_id").eq("user_id", userId).eq("status", "pending").lte("due_date", today);

    const dueIds = [...new Set(((taskData || []) as any[]).map((t: any) => t.contact_id))];

    const { data: all } = await supabase.from("contacts").select("*").eq("user_id", userId)
      .order("priority_order", { ascending: true, nullsFirst: false });

    const allSorted = (all || []) as Contact[];
    setAllContacts(allSorted);

    const priority = ["HIGH", "MED", "LOW"];
    const due = allSorted
      .filter(c => dueIds.includes(c.id))
      .sort((a, b) => priority.indexOf(a.priority_score || "LOW") - priority.indexOf(b.priority_score || "LOW"));

    setContacts(due);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const displayContacts = filter === "due" ? contacts :
    [...allContacts].sort((a, b) => {
      const p = ["HIGH", "MED", "LOW"];
      return p.indexOf(a.priority_score || "LOW") - p.indexOf(b.priority_score || "LOW");
    });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = [...displayContacts];
    const oldIdx = list.findIndex(c => c.id === active.id);
    const newIdx = list.findIndex(c => c.id === over.id);
    const reordered = arrayMove(list, oldIdx, newIdx);
    setContacts(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from("contacts").update({ priority_order: i } as any).eq("id", reordered[i].id);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-navy-100 bg-white">
        <div className="flex gap-2">
          {(["due", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${filter === f ? "text-white" : "text-navy-500 bg-navy-50"}`}
              style={filter === f ? { background: "linear-gradient(135deg, #1e1f6b, #6171f5)" } : {}}>
              {f === "due" ? `Due Today (${contacts.length})` : `All (${allContacts.length})`}
            </button>
          ))}
        </div>
      </div>

      {displayContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="text-5xl mb-4">⭐</div>
          <h3 className="font-display font-bold text-navy-900">All caught up!</h3>
          <p className="text-navy-400 text-sm mt-1">No follow-ups due today.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-touch">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayContacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {displayContacts.map((c, i) => (
                <SortableRow key={c.id} contact={c} index={i} onTap={() => setSelected(c)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {selected && (
        <ContactSheet
          contact={selected} userId={userId}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
            setAllContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}

function SortableRow({ contact: c, index, onTap }: { contact: Contact; index: number; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const ps = PRIORITY_STYLE[c.priority_score || ""] || null;
  const initials = c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div ref={setNodeRef} style={style} className="flex items-center px-4 py-3.5 bg-white border-b border-navy-50 active:bg-navy-50">
      <div {...attributes} {...listeners} className="mr-3 text-navy-200 cursor-grab p-1">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
      </div>
      <div className="w-5 text-center text-xs font-bold text-navy-300 mr-3">{index + 1}</div>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold mr-3 flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>{initials}</div>
      <button onClick={onTap} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-semibold text-navy-900 text-sm">{c.name}</p>
          {ps && <span className={`badge ${ps.bg} ${ps.text}`}>{c.priority_score}</span>}
        </div>
        <p className="text-xs text-navy-400 mt-0.5 truncate">
          {[c.city, c.credit_score, c.campaign].filter(Boolean).join(" · ") || c.phone || "No details"}
        </p>
      </button>
      <div className="flex gap-1.5 ml-2">
        {c.phone && (
          <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6171f5, #8196fa)" }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          </a>
        )}
        {c.phone && (
          <a href={`sms:${c.phone}`} onClick={e => e.stopPropagation()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
          </a>
        )}
      </div>
    </div>
  );
}

function ContactSheet({ contact, userId, onClose, onUpdate }: {
  contact: Contact; userId: string;
  onClose: () => void; onUpdate: (c: Contact) => void;
}) {
  const [nextSteps, setNextSteps] = useState(contact.next_steps || "");
  const [campaign, setCampaign] = useState(contact.campaign || "");
  const [stage, setStage] = useState(contact.pipeline_stage || "Marketing");
  const [priority, setPriority] = useState(contact.priority_score || "");
  const [mlUpdate, setMlUpdate] = useState(contact.ml_update_needed || false);
  const [response, setResponse] = useState(contact.response_received || false);
  const [touchLogs, setTouchLogs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [logNote, setLogNote] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.from("touch_logs").select("*").eq("contact_id", contact.id)
      .order("touched_at", { ascending: false }).limit(10)
      .then(({ data }) => setTouchLogs(data || []));
  }, [contact.id]);

  const logTouch = async (type: TouchType) => {
    const { data } = await supabase.from("touch_logs").insert({
      contact_id: contact.id, user_id: userId,
      touch_type: type, notes: logNote || null,
      touched_at: new Date().toISOString(),
    }).select().single();
    if (data) {
      setTouchLogs(prev => [data, ...prev]);
      await supabase.from("contacts").update({ last_contacted: format(new Date(), "yyyy-MM-dd") } as any).eq("id", contact.id);
      toast.success(`${TOUCH_TYPES.find(t => t.type === type)?.label} logged!`);
      setLogNote("");
    }
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("contacts")
      .update({ next_steps: nextSteps, campaign, pipeline_stage: stage as any,
        priority_score: priority || null, ml_update_needed: mlUpdate,
        response_received: response, updated_at: new Date().toISOString() } as any)
      .eq("id", contact.id).select().single();
    if (error) toast.error("Failed to save");
    else { toast.success("Saved!"); onUpdate(data as Contact); onClose(); }
    setSaving(false);
  };

  const initials = contact.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl safe-bottom max-h-[92vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-navy-200" /></div>

        {/* Header */}
        <div className="px-4 pb-4 border-b border-navy-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-lg"
                style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>{initials}</div>
              <div>
                <h3 className="font-display font-bold text-navy-900">{contact.name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {contact.priority_score && (
                    <span className={`badge ${PRIORITY_STYLE[contact.priority_score]?.bg} ${PRIORITY_STYLE[contact.priority_score]?.text}`}>
                      {contact.priority_score}
                    </span>
                  )}
                  {contact.city && <span className="text-xs text-navy-400">{contact.city}, {contact.state}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Property info */}
          {(contact.credit_score || contact.mortgage_amount || contact.equity_flag !== null) && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {contact.credit_score && (
                <div className="bg-navy-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-navy-400">Credit</p>
                  <p className="text-xs font-bold text-navy-800">{contact.credit_score}</p>
                </div>
              )}
              {contact.equity_flag !== null && (
                <div className={`rounded-xl p-2 text-center ${contact.equity_flag ? "bg-jade-50" : "bg-coral-50"}`}>
                  <p className="text-xs text-navy-400">Equity</p>
                  <p className={`text-xs font-bold ${contact.equity_flag ? "text-jade-700" : "text-coral-700"}`}>
                    {contact.equity_flag ? "YES" : "NO"}
                  </p>
                </div>
              )}
              {contact.mortgage_amount && (
                <div className="bg-gold-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-navy-400">Mortgage</p>
                  <p className="text-xs font-bold text-gold-800 truncate">{contact.mortgage_amount}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Quick contact */}
          <div>
            <p className="section-title mb-2">Contact Now</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold"
                  style={{ background: "linear-gradient(135deg, #6171f5, #8196fa)" }}>
                  <span className="text-xl">📞</span> Call
                </a>
              )}
              {contact.phone && (
                <a href={`sms:${contact.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold"
                  style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}>
                  <span className="text-xl">💬</span> Text
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
                  <span className="text-xl">📧</span> Email
                </a>
              )}
            </div>
          </div>

          {/* Log a touch */}
          <div>
            <p className="section-title mb-2">Log Touch</p>
            <input value={logNote} onChange={e => setLogNote(e.target.value)}
              placeholder="Optional note..." className="input mb-2 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              {TOUCH_TYPES.map(t => (
                <button key={t.type} onClick={() => logTouch(t.type)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-transparent active:scale-95 transition-all text-xs font-semibold"
                  style={{ background: `${t.color}15`, color: t.color, borderColor: `${t.color}30` }}>
                  <span className="text-lg">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Touch history */}
            {touchLogs.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="section-title">Recent History</p>
                {touchLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex items-center gap-2 py-1.5">
                    <span className="text-base">{TOUCH_TYPES.find(t => t.type === log.touch_type)?.emoji || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-navy-700">{TOUCH_TYPES.find(t => t.type === log.touch_type)?.label || log.touch_type}</span>
                      {log.notes && <span className="text-xs text-navy-400 ml-1">— {log.notes}</span>}
                    </div>
                    <span className="text-xs text-navy-300 flex-shrink-0">{format(new Date(log.touched_at), "MMM d")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Update fields */}
          <div className="space-y-3">
            <p className="section-title">Update Contact</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="input text-sm py-2">
                  <option value="">None</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MED">MED</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1">Pipeline</label>
                <select value={stage} onChange={e => setStage(e.target.value)} className="input text-sm py-2">
                  {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1">Campaign</label>
              <select value={campaign} onChange={e => setCampaign(e.target.value)} className="input text-sm py-2">
                <option value="">No campaign</option>
                {ALL_CAMPAIGNS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1">Next Steps</label>
              <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)}
                placeholder="What's next for this contact?" className="input text-sm resize-none" rows={3} />
            </div>

            {/* Flags */}
            <div className="flex gap-2">
              <button onClick={() => setMlUpdate(!mlUpdate)}
                className={`flex-1 flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${mlUpdate ? "border-gold-400 bg-gold-50" : "border-navy-100 bg-white"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mlUpdate ? "bg-gold-400 border-gold-400" : "border-navy-300"}`}>
                  {mlUpdate && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span className="text-xs font-semibold text-navy-700">Update ML</span>
              </button>
              <button onClick={() => setResponse(!response)}
                className={`flex-1 flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${response ? "border-jade-400 bg-jade-50" : "border-navy-100 bg-white"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${response ? "bg-jade-400 border-jade-400" : "border-navy-300"}`}>
                  {response && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span className="text-xs font-semibold text-navy-700">Responded</span>
              </button>
            </div>

            {/* Notes from import */}
            {contact.notes && (
              <div>
                <p className="section-title mb-1">Import Notes</p>
                <div className="p-3 bg-navy-50 rounded-xl text-xs text-navy-600">{contact.notes}</div>
              </div>
            )}
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
