"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Contact, TouchType } from "@/lib/database.types";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "bg-coral-50", text: "text-coral-700", border: "border-coral-200" },
  MED:  { bg: "bg-gold-50",  text: "text-gold-700",  border: "border-gold-200"  },
  LOW:  { bg: "bg-navy-50",  text: "text-navy-600",  border: "border-navy-200"  },
};

const TOUCH_TYPES: { type: TouchType; label: string; emoji: string; color: string }[] = [
  { type: "call",     label: "Called",     emoji: "📞", color: "#6171f5" },
  { type: "text",     label: "Texted",     emoji: "💬", color: "#10b981" },
  { type: "email",    label: "Emailed",    emoji: "📧", color: "#8b5cf6" },
  { type: "door",     label: "Door Knock", emoji: "🚪", color: "#f59e0b" },
  { type: "postcard", label: "Postcard",   emoji: "📮", color: "#f94021" },
  { type: "bombbomb", label: "BombBomb",   emoji: "🎥", color: "#ec4899" },
];

const ALL_CAMPAIGNS = ["8x8 Buyer", "Seller Nurture", "Past Client", "Absentee Owner", "Other"];
const ALL_STAGES = ["Marketing", "Processing", "In Contract", "Other"];

type Task = { id: string; description: string; due_date: string; status: string };

export default function PriorityList({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: allContacts, error: contactErr } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });

      if (contactErr) throw contactErr;

      const priorityOrder = ["HIGH", "MED", "LOW"];
      const ranked = ((allContacts || []) as Contact[]).sort((a, b) => {
        const ai = priorityOrder.indexOf(a.priority_score || "NONE");
        const bi = priorityOrder.indexOf(b.priority_score || "NONE");
        const aVal = ai === -1 ? 99 : ai;
        const bVal = bi === -1 ? 99 : bi;
        return aVal - bVal;
      });
      setContacts(ranked);

      if (ranked.length > 0) {
        const ids = ranked.map(c => c.id);
        const { data: tasks, error: taskErr } = await supabase
          .from("tasks")
          .select("*")
          .in("contact_id", ids)
          .eq("status", "pending")
          .order("due_date");

        if (taskErr) throw taskErr;

        const map: Record<string, Task[]> = {};
        for (const t of (tasks || []) as any[]) {
          if (!map[t.contact_id]) map[t.contact_id] = [];
          map[t.contact_id].push(t as Task);
        }
        setTaskMap(map);
      }
    } catch (e: any) {
      console.error("PriorityList error:", e);
      setError(e?.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = contacts.findIndex(c => c.id === active.id);
    const newIdx = contacts.findIndex(c => c.id === over.id);
    const reordered = arrayMove(contacts, oldIdx, newIdx);
    setContacts(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from("contacts").update({ priority_order: i } as any).eq("id", reordered[i].id);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <p className="text-coral-600 font-semibold mb-2">Failed to load</p>
      <p className="text-navy-400 text-sm mb-4">{error}</p>
      <button onClick={fetchData} className="btn-primary">Try Again</button>
    </div>
  );

  const groupedByPriority = ["HIGH", "MED", "LOW"].reduce((acc, p) => {
    acc[p] = contacts.filter(c => c.priority_score === p);
    return acc;
  }, {} as Record<string, Contact[]>);
  const noPriority = contacts.filter(c => !c.priority_score);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2 bg-white border-b border-navy-100">
        <p className="text-xs text-navy-400 font-medium">{contacts.length} contacts · drag to reorder</p>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-display font-bold text-navy-900">No contacts yet</h3>
          <p className="text-navy-400 text-sm mt-1">Import contacts to see them here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-touch">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {["HIGH", "MED", "LOW"].map(priority => {
                const group = groupedByPriority[priority];
                if (!group?.length) return null;
                const ps = PRIORITY_STYLE[priority];
                return (
                  <div key={priority}>
                    <div className={`px-4 py-2 ${ps.bg} border-b ${ps.border}`}>
                      <p className={`section-title ${ps.text}`}>{priority} Priority · {group.length}</p>
                    </div>
                    {group.map(c => (
                      <SortableRow key={c.id} contact={c} tasks={taskMap[c.id] || []} onTap={() => setSelected(c)} />
                    ))}
                  </div>
                );
              })}
              {noPriority.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="section-title text-slate-500">No Priority · {noPriority.length}</p>
                  </div>
                  {noPriority.map(c => (
                    <SortableRow key={c.id} contact={c} tasks={taskMap[c.id] || []} onTap={() => setSelected(c)} />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {selected && (
        <ContactSheet
          contact={selected}
          userId={userId}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelected(updated);
          }}
          onTaskUpdate={(contactId, tasks) => setTaskMap(prev => ({ ...prev, [contactId]: tasks }))}
        />
      )}
    </div>
  );
}

function SortableRow({ contact: c, tasks, onTap }: { contact: Contact; tasks: Task[]; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const initials = c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const ps = PRIORITY_STYLE[c.priority_score || ""];
  const nextTask = tasks[0];

  return (
    <div ref={setNodeRef} style={style} className="bg-white border-b border-navy-50">
      <div className="flex items-start px-4 py-3 gap-3">
        <div {...attributes} {...listeners} className="mt-1 text-navy-200 cursor-grab p-1 flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>{initials}</div>
        <button onClick={onTap} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display font-semibold text-navy-900 text-sm">{c.name}</p>
            {ps && <span className={`badge ${ps.bg} ${ps.text}`}>{c.priority_score}</span>}
          </div>
          {nextTask ? (
            <p className="text-xs text-navy-500 mt-0.5 truncate">
              → {nextTask.description}
              <span className="text-navy-300 ml-1">· {format(parseISO(nextTask.due_date), "MMM d")}</span>
            </p>
          ) : (
            <p className="text-xs text-navy-300 mt-0.5">{c.campaign || c.city || "No task"}</p>
          )}
        </button>
        <div className="flex gap-1.5 ml-1 flex-shrink-0">
          {c.phone && (
            <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6171f5, #8196fa)" }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
            </a>
          )}
          {c.phone && (
            <a href={`sms:${c.phone}`} onClick={e => e.stopPropagation()}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactSheet({ contact, userId, onClose, onUpdate, onTaskUpdate }: {
  contact: Contact; userId: string;
  onClose: () => void;
  onUpdate: (c: Contact) => void;
  onTaskUpdate: (contactId: string, tasks: Task[]) => void;
}) {
  const [nextSteps, setNextSteps] = useState((contact as any).next_steps || "");
  const [dueDays, setDueDays] = useState(1);
  const [campaign, setCampaign] = useState(contact.campaign || "");
  const [stage, setStage] = useState(contact.pipeline_stage || "Marketing");
  const [priority, setPriority] = useState(contact.priority_score || "");
  const [mlUpdate, setMlUpdate] = useState(contact.ml_update_needed || false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [touchLogs, setTouchLogs] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "tasks">("actions");
  const supabase = createClient();

  useEffect(() => {
    supabase.from("tasks").select("*").eq("contact_id", contact.id)
      .eq("status", "pending").order("due_date")
      .then(({ data }) => {
        const t = (data || []) as Task[];
        setTasks(t);
        onTaskUpdate(contact.id, t);
      });
    supabase.from("touch_logs").select("*").eq("contact_id", contact.id)
      .order("touched_at", { ascending: false }).limit(5)
      .then(({ data }) => setTouchLogs(data || []));
  }, [contact.id]);

  const logTouch = async (type: TouchType) => {
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    await supabase.from("touch_logs").insert({
      contact_id: contact.id, user_id: userId, touch_type: type, touched_at: now,
    } as any);
    await supabase.from("contacts").update({ last_contacted: today } as any).eq("id", contact.id);
    const actMap: Record<string, string> = {
      call: "calls", text: "texts", email: "texts",
      door: "door_knocking", postcard: "networking", bombbomb: "conversations", other: "conversations",
    };
    const col = actMap[type] || "conversations";
    const { data: existingArr } = await supabase.from("daily_activities")
  .select("*").eq("user_id", userId).eq("date", today).limit(1);
const existing = existingArr?.[0] || null;
    if (existing) {
      await supabase.from("daily_activities")
        .update({ [col]: ((existing as any)[col] || 0) + 1, updated_at: now } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("daily_activities").insert({ user_id: userId, date: today, [col]: 1 } as any);
    }
    const tt = TOUCH_TYPES.find(t2 => t2.type === type);
    toast.success(`${tt?.label} logged & tracked!`);
    setTouchLogs(prev => [{ id: Date.now(), touch_type: type, touched_at: now, notes: null }, ...prev.slice(0, 4)]);
  };

  const save = async () => {
    setSaving(true);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().split("T")[0];
    const { data } = await supabase.from("contacts")
      .update({ next_steps: nextSteps, campaign, pipeline_stage: stage as any,
        priority_score: priority || null, ml_update_needed: mlUpdate,
        updated_at: new Date().toISOString() } as any)
      .eq("id", contact.id).select().single();
    if (data) onUpdate(data as Contact);
    if (nextSteps?.trim()) {
      const { data: existing } = await supabase.from("tasks").select("id")
        .eq("contact_id", contact.id).eq("status", "pending").limit(1);
      if (existing && existing.length > 0) {
        await supabase.from("tasks").update({ description: nextSteps, due_date: dueDateStr })
          .eq("id", (existing[0] as any).id);
      } else {
        await supabase.from("tasks").insert({
          contact_id: contact.id, user_id: userId,
          description: nextSteps, due_date: dueDateStr, status: "pending",
        } as any);
      }
      const { data: newTasks } = await supabase.from("tasks").select("*")
        .eq("contact_id", contact.id).eq("status", "pending").order("due_date");
      const t = (newTasks || []) as Task[];
      setTasks(t);
      onTaskUpdate(contact.id, t);
    }
    toast.success("Saved!");
    setSaving(false);
    onClose();
  };

  const completeTask = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    onTaskUpdate(contact.id, updated);
    toast.success("Task done!");
  };

  const saveTaskEdit = async (task: Task, newDesc: string, newDate: string) => {
    await supabase.from("tasks").update({ description: newDesc, due_date: newDate }).eq("id", task.id);
    const updated = tasks.map(t => t.id === task.id ? { ...t, description: newDesc, due_date: newDate } : t);
    setTasks(updated);
    onTaskUpdate(contact.id, updated);
    setEditingTask(null);
    toast.success("Task updated!");
  };

  const initials = contact.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl safe-bottom max-h-[92vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-navy-200" /></div>
        <div className="px-4 pb-3 border-b border-navy-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold"
                style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>{initials}</div>
              <div>
                <h3 className="font-display font-bold text-navy-900">{contact.name}</h3>
                <p className="text-xs text-navy-400">{contact.pipeline_stage} · {contact.city || contact.phone || "No details"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          {(contact.credit_score || contact.equity_flag !== null || contact.mortgage_amount) && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {contact.credit_score && <span className="badge bg-navy-50 text-navy-700">Credit: {contact.credit_score}</span>}
              {contact.equity_flag !== null && <span className={`badge ${contact.equity_flag ? "bg-jade-50 text-jade-700" : "bg-coral-50 text-coral-700"}`}>Equity: {contact.equity_flag ? "YES" : "NO"}</span>}
              {contact.mortgage_amount && <span className="badge bg-gold-50 text-gold-700">{contact.mortgage_amount}</span>}
            </div>
          )}
        </div>

        <div className="flex border-b border-navy-100">
          {(["actions", "tasks"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? "text-navy-800 border-b-2 border-navy-800" : "text-navy-400"}`}>
              {tab} {tab === "tasks" && tasks.length > 0 ? `(${tasks.length})` : ""}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 space-y-4">
          {activeTab === "actions" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {contact.phone && <a href={`tel:${contact.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #6171f5, #8196fa)" }}><span className="text-xl">📞</span>Call</a>}
                {contact.phone && <a href={`sms:${contact.phone}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}><span className="text-xl">💬</span>Text</a>}
                {contact.email && <a href={`mailto:${contact.email}`} className="flex flex-col items-center gap-1 p-3 rounded-2xl text-white text-xs font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}><span className="text-xl">📧</span>Email</a>}
              </div>

              <div>
                <p className="section-title mb-2">Log Touch → Syncs to Tracker</p>
                <div className="grid grid-cols-3 gap-2">
                  {TOUCH_TYPES.map(tt => (
                    <button key={tt.type} onClick={() => logTouch(tt.type)}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 active:scale-95 transition-all text-xs font-semibold"
                      style={{ background: `${tt.color}15`, color: tt.color, borderColor: `${tt.color}30` }}>
                      <span className="text-lg">{tt.emoji}</span>{tt.label}
                    </button>
                  ))}
                </div>
                {touchLogs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {touchLogs.map((log, i) => {
                      const tt = TOUCH_TYPES.find(t => t.type === log.touch_type);
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-navy-500">
                          <span>{tt?.emoji}</span>
                          <span>{tt?.label}</span>
                          <span className="text-navy-300">· {format(new Date(log.touched_at), "MMM d, h:mm a")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="section-title mb-2">Next Steps</p>
                <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)}
                  placeholder="What's next? Will auto-create a task." className="input text-sm resize-none" rows={2} />
                <div className="mt-2">
                  <p className="text-xs text-navy-500 font-medium mb-1.5">Due in:</p>
                  <div className="flex gap-2">
                    {[1, 3, 7, 14].map(days => (
                      <button key={days} onClick={() => setDueDays(days)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${dueDays === days ? "text-white" : "bg-navy-50 text-navy-500"}`}
                        style={dueDays === days ? { background: "linear-gradient(135deg, #1e1f6b, #6171f5)" } : {}}>
                        {days === 1 ? "1 day" : `${days}d`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
              <button onClick={() => setMlUpdate(!mlUpdate)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${mlUpdate ? "border-gold-400 bg-gold-50" : "border-navy-100"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mlUpdate ? "bg-gold-400 border-gold-400" : "border-navy-300"}`}>
                  {mlUpdate && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span className="text-sm font-semibold text-navy-700">Flag: Update Market Leader</span>
              </button>
              <button onClick={save} disabled={saving} className="btn-primary w-full">
                {saving ? "Saving..." : "Save & Create Task"}
              </button>
            </>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-center text-navy-400 text-sm py-6">No pending tasks. Add a Next Step from Actions.</p>
              ) : tasks.map(task => (
                <div key={task.id}>
                  {editingTask?.id === task.id ? (
                    <EditTaskInline task={task} onSave={saveTaskEdit} onCancel={() => setEditingTask(null)} />
                  ) : (
                    <div className="card p-3 flex items-start gap-3">
                      <button onClick={() => completeTask(task.id)}
                        className="mt-0.5 w-6 h-6 rounded-full border-2 border-navy-200 hover:border-jade-500 flex-shrink-0 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900">{task.description}</p>
                        <p className="text-xs text-navy-400 mt-0.5">Due {format(parseISO(task.due_date), "MMM d, yyyy")}</p>
                      </div>
                      <button onClick={() => setEditingTask(task)}
                        className="w-7 h-7 rounded-full bg-navy-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EditTaskInline({ task, onSave, onCancel }: {
  task: Task; onSave: (task: Task, desc: string, date: string) => void; onCancel: () => void;
}) {
  const [desc, setDesc] = useState(task.description);
  const [date, setDate] = useState(task.due_date);
  return (
    <div className="card p-3 space-y-2 border-navy-300">
      <input value={desc} onChange={e => setDesc(e.target.value)} className="input text-sm py-2" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm py-2" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary flex-1 text-sm py-1.5">Cancel</button>
        <button onClick={() => onSave(task, desc, date)} className="btn-primary flex-1 text-sm py-1.5">Save</button>
      </div>
    </div>
  );
}
