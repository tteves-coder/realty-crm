"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { format, isToday, isPast, parseISO, isValid } from "date-fns";
import toast from "react-hot-toast";

type TaskWithContact = {
  id: string; description: string; due_date: string; status: string;
  contacts: { name: string; campaign: string | null; pipeline_stage: string; phone: string | null } | null;
};

const STAGE_GRAD: Record<string, string> = {
  Marketing: "from-blue-500 to-blue-400",
  Processing: "from-amber-500 to-amber-400",
  "In Contract": "from-jade-500 to-jade-400",
  Other: "from-navy-400 to-navy-300",
};

export default function TodayView({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<TaskWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase.from("tasks")
      .select("*, contacts(name, campaign, pipeline_stage, phone)")
      .eq("user_id", userId).eq("status", "pending").lte("due_date", today)
      .order("due_date", { ascending: true });
    if (error) toast.error("Failed to load tasks");
    else setTasks((data as any) || []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const complete = async (id: string) => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Done! ✓");
  };

  const overdue = tasks.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isPast(d) && !isToday(d); });
  const dueToday = tasks.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isToday(d); });

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-3 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>;

  return (
    <div className="h-full overflow-y-auto scroll-touch">
      {/* Header card */}
      <div className="mx-4 mt-4 mb-3 rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1f6b, #6171f5)" }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #fff, transparent)", transform: "translate(30%, -30%)" }} />
        <p className="text-navy-200 text-sm font-medium">{format(new Date(), "EEEE, MMMM d")}</p>
        <p className="text-4xl font-display font-bold mt-1">{tasks.length}</p>
        <p className="text-navy-200 text-sm">{tasks.length === 1 ? "task remaining" : "tasks remaining"}</p>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-display font-bold text-navy-900">All caught up!</h3>
          <p className="text-navy-400 text-sm mt-1">No tasks due today. Crush it!</p>
        </div>
      ) : (
        <div className="px-4 space-y-4 pb-4">
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-coral-500" />
                <p className="section-title text-coral-600">Overdue — {overdue.length}</p>
              </div>
              <div className="space-y-2">
                {overdue.map(t => <TaskCard key={t.id} task={t} onComplete={complete} overdue />)}
              </div>
            </div>
          )}
          {dueToday.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-jade-500" />
                <p className="section-title text-jade-700">Due Today — {dueToday.length}</p>
              </div>
              <div className="space-y-2">
                {dueToday.map(t => <TaskCard key={t.id} task={t} onComplete={complete} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onComplete, overdue }: { task: TaskWithContact; onComplete: (id: string) => void; overdue?: boolean }) {
  const [done, setDone] = useState(false);
  const stage = task.contacts?.pipeline_stage || "Other";
  const grad = STAGE_GRAD[stage] || STAGE_GRAD.Other;

  return (
    <div className={`card p-4 flex items-start gap-3 ${overdue ? "border-coral-200 bg-coral-50/30" : ""}`}>
      <button onClick={() => { setDone(true); onComplete(task.id); }}
        className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 transition-all ${done ? "bg-jade-500 border-jade-500" : overdue ? "border-coral-400 hover:border-coral-600" : "border-navy-200 hover:border-navy-500"}`}>
        {done && <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-navy-900 text-sm">{task.contacts?.name || "Unknown"}</p>
        <p className="text-navy-600 text-sm mt-0.5">{task.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${grad}`}>{stage}</span>
          {task.contacts?.campaign && <span className="text-xs text-navy-400">{task.contacts.campaign}</span>}
          {overdue && <span className="text-xs font-semibold text-coral-600">Overdue</span>}
        </div>
      </div>
      {task.contacts?.phone && (
        <a href={`tel:${task.contacts.phone}`} className="flex-shrink-0 w-9 h-9 rounded-full bg-navy-50 flex items-center justify-center">
          <svg className="w-4 h-4 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        </a>
      )}
    </div>
  );
}
