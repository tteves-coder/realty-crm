
Output the file content for copying

Output the file content for copying
bash

cat /home/claude/crm-v3/components/tasks/TodayView.tsx
Output

"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { format, isToday, isPast, parseISO, isValid, isTomorrow, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type TaskWithContact = {
  id: string; description: string; due_date: string; status: string;
  contacts: { id: string; name: string; campaign: string | null; pipeline_stage: string; phone: string | null } | null;
};

const STAGE_GRAD: Record<string, string> = {
  Marketing: "linear-gradient(135deg, #6171f5, #8196fa)",
  Processing: "linear-gradient(135deg, #f59e0b, #fcd34d)",
  "In Contract": "linear-gradient(135deg, #10b981, #34d399)",
  Other: "linear-gradient(135deg, #64748b, #94a3b8)",
};

export default function TodayView({ userId }: { userId: string }) {
  const [overdue, setOverdue] = useState<TaskWithContact[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskWithContact[]>([]);
  const [upcoming, setUpcoming] = useState<TaskWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const futureDate = format(future, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts(id, name, campaign, pipeline_stage, phone)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("due_date", futureDate)
      .order("due_date", { ascending: true });

    if (error) { toast.error("Failed to load tasks"); setLoading(false); return; }

    const all = (data as TaskWithContact[]) || [];
    setOverdue(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isPast(d) && !isToday(d); }));
    setTodayTasks(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && isToday(d); }));
    setUpcoming(all.filter(t => { const d = parseISO(t.due_date); return isValid(d) && !isPast(d) && !isToday(d); }));
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const complete = async (id: string) => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
    setOverdue(prev => prev.filter(t => t.id !== id));
    setTodayTasks(prev => prev.filter(t => t.id !== id));
    setUpcoming(prev => prev.filter(t => t.id !== id));
    toast.success("Done! ✓");
  };

  const total = overdue.length + todayTasks.length;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto scroll-touch">
      {/* Header card */}
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
        </div>
      </div>

      {total === 0 && upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-display font-bold text-navy-900">All caught up!</h3>
          <p className="text-navy-400 text-sm mt-1">No tasks due. Crush it today!</p>
        </div>
      ) : (
        <div className="px-4 space-y-4 pb-4">
          {/* Overdue */}
          {overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length} accent="text-coral-600" dot="bg-coral-500">
              {overdue.map(t => <TaskCard key={t.id} task={t} onComplete={complete} variant="overdue" />)}
            </Section>
          )}

          {/* Today */}
          {todayTasks.length > 0 && (
            <Section title="Due Today" count={todayTasks.length} accent="text-jade-700" dot="bg-jade-500">
              {todayTasks.map(t => <TaskCard key={t.id} task={t} onComplete={complete} variant="today" />)}
            </Section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <Section title="Upcoming — Next 14 Days" count={upcoming.length} accent="text-navy-500" dot="bg-navy-400">
              {upcoming.map(t => <TaskCard key={t.id} task={t} onComplete={complete} variant="upcoming" />)}
            </Section>
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

function TaskCard({ task: t, onComplete, variant }: {
  task: TaskWithContact;
  onComplete: (id: string) => void;
  variant: "overdue" | "today" | "upcoming";
}) {
  const [done, setDone] = useState(false);
  const router = useRouter();
  const stage = t.contacts?.pipeline_stage || "Other";
  const d = parseISO(t.due_date);

  const daysUntil = isValid(d) ? differenceInDays(d, new Date()) : null;
  const dateLabel = variant === "overdue"
    ? `Overdue · ${format(d, "MMM d")}`
    : variant === "today"
    ? "Due today"
    : isTomorrow(d)
    ? "Tomorrow"
    : `${format(d, "EEE, MMM d")}`;

  const borderColor = variant === "overdue" ? "border-coral-200 bg-coral-50/20" :
                      variant === "today" ? "border-jade-100" : "";

  return (
    <div className={`card p-4 flex items-start gap-3 ${borderColor}`}>
      {/* Complete button */}
      <button
        onClick={() => { setDone(true); onComplete(t.id); }}
        className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
          done ? "bg-jade-500 border-jade-500" :
          variant === "overdue" ? "border-coral-400 hover:border-coral-600" :
          "border-navy-200 hover:border-navy-500"
        }`}>
        {done && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
      </button>

      {/* Content */}
      <button className="flex-1 text-left min-w-0" onClick={() => t.contacts?.id && router.push(`/contacts/${t.contacts.id}`)}>
        <p className="font-display font-semibold text-navy-900 text-sm">{t.contacts?.name || "Unknown"}</p>
        <p className="text-navy-600 text-sm mt-0.5">{t.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white`}
            style={{ background: STAGE_GRAD[stage] || STAGE_GRAD.Other }}>{stage}</span>
          {t.contacts?.campaign && <span className="text-xs text-navy-400">{t.contacts.campaign}</span>}
          <span className={`text-xs font-medium ${
            variant === "overdue" ? "text-coral-600" :
            variant === "today" ? "text-jade-600" :
            "text-navy-400"
          }`}>{dateLabel}</span>
        </div>
      </button>

      {/* Call button */}
      {t.contacts?.phone && (
        <a href={`tel:${t.contacts.phone}`}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-navy-50 flex items-center justify-center"
          onClick={e => e.stopPropagation()}>
          <svg className="w-4 h-4 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
