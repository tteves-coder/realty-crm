"use client";
import React from "react";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { format, isToday, isPast, parseISO, isValid, isTomorrow } from "date-fns";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ContactType } from "@/lib/database.types";

type Task = {
  id: string;
  description: string;
  due_date: string;
  status: string;
  contacts: {
    id: string;
    name: string;
    campaign: string | null;
    pipeline_stage: string;
    phone: string | null;
    contact_type: ContactType | null;
    partner_category: string | null;
  } | null;
};

type FilterType = "All" | "Client" | "Partner" | "Lead";

const STAGE_GRAD: Record<string, string> = {
  Marketing: "linear-gradient(135deg, #6171f5, #8196fa)",
  Processing: "linear-gradient(135deg, #f59e0b, #fcd34d)",
  "In Contract": "linear-gradient(135deg, #10b981, #34d399)",
  Other: "linear-gradient(135deg, #64748b, #94a3b8)",
};

const PARTNER_GRAD = "linear-gradient(135deg, #0d9488, #2dd4bf)";

export default function TodayView({ userId }: { userId: string }) {
  const [allOverdue, setAllOverdue] = useState<Task[]>([]);
  const [allTodayTasks, setAllTodayTasks] = useState<Task[]>([]);
  const [allUpcoming, setAllUpcoming] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterType>("All");
  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const futureDate = format(future, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts(id, name, campaign, pipeline_stage, phone, contact_type, partner_category)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("due_date", futureDate)
      .order("due_date", { ascending: true });
    if (error) {
      toast.error("Failed to load tasks");
      setLoading(false);
      return;
    }
    const all = (data as Task[]) || [];
    setAllOverdue(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isPast(d) && !isToday(d); }));
    setAllTodayTasks(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isToday(d); }));
    setAllUpcoming(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && !isPast(d) && !isToday(d); }));
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Apply filter
  const applyFilter = (tasks: Task[]): Task[] => {
    if (filter === "All") return tasks;
    return tasks.filter(t => (t.contacts?.contact_type || "Client") === filter);
  };

  const overdue = applyFilter(allOverdue);
  const todayTasks = applyFilter(allTodayTasks);
  const upcoming = applyFilter(allUpcoming);

  const removeTask = (id: string) => {
    setAllOverdue(p => p.filter(t => t.id !== id));
    setAllTodayTasks(p => p.filter(t => t.id !== id));
    setAllUpcoming(p => p.filter(t => t.id !== id));
  };

  const updateTask = (updated: Task) => {
    const update = (list: Task[]) => list.map(t => t.id === updated.id ? updated : t);
    setAllOverdue(update);
    setAllTodayTasks(update);
    setAllUpcoming(update);
  };

  const total = todayTasks.length;

  // Counts for the filter chips
  const counts: Record<FilterType, number> = {
    All: allOverdue.length + allTodayTasks.length + allUpcoming.length,
    Client: [...allOverdue, ...allTodayTasks, ...allUpcoming].filter(t => (t.contacts?.contact_type || "Client") === "Client").length,
    Partner: [...allOverdue, ...allTodayTasks, ...allUpcoming].filter(t => t.contacts?.contact_type === "Partner").length,
    Lead: [...allOverdue, ...allTodayTasks, ...allUpcoming].filter(t => t.contacts?.contact_type === "Lead").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto scroll-touch">
      {/* Header */}
      <div className="mx-4 mt-4 mb-3 rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #fff, transparent)", transform: "translate(30%, -30%)" }} />
        <p className="text-navy-200 text-sm font-medium">{format(new Date(), "EEEE, MMMM d")}</p>
        <div className="flex items-baseline gap-3 mt-1">
          <div>
            <p className="text-4xl font-display font-bold">{total}</p>
            <p className="text-navy-200 text-xs">due today</p>
          </div>
          {upcoming.length > 0 && (
            <div className="border-l border-white/20 pl-3">
              <p className="text-2xl font-display font-bold text-white/70">{upcoming.length}</p>
              <p className="text-navy-300 text-xs">upcoming</p>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="border-l border-white/20 pl-3">
              <p className="text-2xl font-display font-bold text-coral-300">{overdue.length}</p>
              <p className="text-navy-300 text-xs">overdue</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {(["All", "Client", "Partner", "Lead"] as FilterType[]).map(f => {
          const active = filter === f;
          const count = counts[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active
                  ? "bg-navy-900 text-white"
                  : "bg-white text-navy-500 border border-navy-200 hover:border-navy-400"
              }`}
            >
              {f} <span className={active ? "text-white/70" : "text-navy-400"}>· {count}</span>
            </button>
          );
        })}
      </div>

      {total === 0 && upcoming.length === 0 && overdue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-display font-bold text-navy-900">
            {filter === "All" ? "All caught up!" : `No ${filter} tasks.`}
          </h3>
          <p className="text-navy-400 text-sm mt-1">
            {filter === "All" ? "No tasks due. Crush it today!" : "Switch filter to see other tasks."}
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-4 pb-4">
          {todayTasks.length > 0 && (
            <Section title="Due Today" count={todayTasks.length} accent="text-jade-700" dot="bg-jade-500">
              {todayTasks.map(t => <TaskCard key={t.id} task={t} userId={userId} variant="today" onRemove={removeTask} onUpdate={updateTask} />)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming — Next 14 Days" count={upcoming.length} accent="text-navy-500" dot="bg-navy-400">
              {upcoming.map(t => <TaskCard key={t.id} task={t} userId={userId} variant="upcoming" onRemove={removeTask} onUpdate={updateTask} />)}
            </Section>
          )}
          {overdue.length > 0 && (
            <div>
              <button
                onClick={() => setOverdueExpanded(v => !v)}
                className="w-full flex items-center justify-between gap-2 mb-2 py-1 active:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-coral-500" />
                  <p className="section-title text-coral-600">Overdue — {overdue.length}</p>
                </div>
                <span className="text-xs text-coral-500 font-semibold">
                  {overdueExpanded ? "Hide ▲" : "Tap to show ▼"}
                </span>
              </button>
              {overdueExpanded && (
                <div className="space-y-2">
                  {overdue.map(t => <TaskCard key={t.id} task={t} userId={userId} variant="overdue" onRemove={removeTask} onUpdate={updateTask} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, accent, dot, children }: {
  title: string; count: number; accent: string; dot: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className={`section-title ${accent}`}>{title} — {count}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TaskCard({ task: t, userId, variant, onRemove, onUpdate }: {
  task: Task;
  userId: string;
  variant: "overdue" | "today" | "upcoming";
  onRemove: (id: string) => void;
  onUpdate: (t: Task) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(t.description);
  const [dueDate, setDueDate] = useState(t.due_date);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const isPartner = t.contacts?.contact_type === "Partner";
  const stage = t.contacts?.pipeline_stage || "Other";
  const badgeGradient = isPartner ? PARTNER_GRAD : STAGE_GRAD[stage];
  const badgeLabel = isPartner ? (t.contacts?.partner_category || "Partner") : stage;
  const d = parseISO(t.due_date);
  const dateLabel = variant === "overdue"
    ? `Overdue · ${format(d, "MMM d")}`
    : variant === "today" ? "Due today"
    : isTomorrow(d) ? "Tomorrow"
    : format(d, "EEE, MMM d");
  const borderColor = variant === "overdue" ? "border-coral-200 bg-coral-50/20" :
    variant === "today" ? "border-jade-100" : "";

  const complete = async () => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", t.id);
    onRemove(t.id);
    toast.success("Done! ✓");
  };

  const saveEdit = async () => {
    setSaving(true);
    const { data } = await supabase.from("tasks")
      .update({ description: desc, due_date: dueDate })
      .eq("id", t.id).select().single();
    if (data) { onUpdate({ ...t, description: desc, due_date: dueDate }); toast.success("Updated!"); }
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="card p-4 space-y-2 border-navy-200">
        <p className="text-xs font-semibold text-navy-500">{t.contacts?.name}</p>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          className="input text-sm py-2" placeholder="Task description" />
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="input text-sm py-2" />
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
          <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 text-sm py-2">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-4 flex items-start gap-3 ${borderColor}`}>
      <button onClick={complete}
        className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
          variant === "overdue" ? "border-coral-400 hover:border-coral-600" : "border-navy-200 hover:border-navy-500"
        }`} />
      <button className="flex-1 text-left min-w-0"
        onClick={() => t.contacts?.id && router.push(`/contacts/${t.contacts.id}`)}>
        <p className="font-display font-semibold text-navy-900 text-sm">{t.contacts?.name || "Unknown"}</p>
        <p className="text-navy-600 text-sm mt-0.5">{t.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ background: badgeGradient }}>{badgeLabel}</span>
          {!isPartner && t.contacts?.campaign && (
            <span className="text-xs text-navy-400">{t.contacts.campaign}</span>
          )}
          <span className={`text-xs font-medium ${
            variant === "overdue" ? "text-coral-600" : variant === "today" ? "text-jade-600" : "text-navy-400"
          }`}>{dateLabel}</span>
        </div>
      </button>
      <div className="flex flex-col gap-1">
        <button onClick={() => setEditing(true)}
          className="w-8 h-8 rounded-full bg-navy-50 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        {t.contacts?.phone && (
          <a href={`tel:${t.contacts.phone}`}
            className="w-8 h-8 rounded-full bg-navy-50 flex items-center justify-center"
            onClick={e => e.stopPropagation()}>
            <svg className="w-3.5 h-3.5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
