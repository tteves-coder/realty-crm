"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth } from "date-fns";
import toast from "react-hot-toast";
import { DailyActivity } from "@/lib/database.types";

type ActivityKey = keyof Omit<DailyActivity, "id" | "user_id" | "date">;

const ACTIVITIES: { key: ActivityKey; label: string; emoji: string; gradient: string }[] = [
  { key: "calls",          label: "Calls",        emoji: "📞", gradient: "linear-gradient(135deg, #6171f5, #8196fa)" },
  { key: "texts",          label: "Texts",        emoji: "💬", gradient: "linear-gradient(135deg, #10b981, #34d399)" },
  { key: "met",            label: "Met",          emoji: "☕", gradient: "linear-gradient(135deg, #0d9488, #2dd4bf)" },
  { key: "sent_content",   label: "Sent Content", emoji: "📤", gradient: "linear-gradient(135deg, #f59e0b, #fcd34d)" },
  { key: "realtors",       label: "Realtors",     emoji: "🏠", gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
  { key: "networking",     label: "Networking",   emoji: "🤝", gradient: "linear-gradient(135deg, #ec4899, #f9a8d4)" },
  { key: "conversations",  label: "Convos",       emoji: "💭", gradient: "linear-gradient(135deg, #f94021, #ff6b52)" },
  { key: "appts_set",      label: "Appts Set",    emoji: "📅", gradient: "linear-gradient(135deg, #0ea5e9, #38bdf8)" },
  { key: "appts_conducted",label: "Appts Done",   emoji: "✅", gradient: "linear-gradient(135deg, #047857, #10b981)" },
  { key: "clients",        label: "Clients",      emoji: "⭐", gradient: "linear-gradient(135deg, #d97706, #f59e0b)" },
  { key: "leads",          label: "New Leads",    emoji: "🎯", gradient: "linear-gradient(135deg, #dc2626, #f87171)" },
  { key: "closings",       label: "Closings",     emoji: "🎉", gradient: "linear-gradient(135deg, #1e1f6b, #6171f5)" },
];

const empty = (userId: string, date: string): DailyActivity => ({
  user_id: userId, date,
  calls: 0, texts: 0, met: 0, sent_content: 0, realtors: 0, networking: 0,
  conversations: 0, appts_set: 0, appts_conducted: 0, clients: 0, leads: 0, closings: 0,
});

export default function ActivityTracker({ userId }: { userId: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [todayData, setTodayData] = useState<DailyActivity>(empty(userId, today));
  const [monthTotals, setMonthTotals] = useState<Partial<DailyActivity>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ActivityKey | null>(null);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const { data } = await supabase.from("daily_activities").select("*")
      .eq("user_id", userId).gte("date", start).lte("date", end);

    if (data) {
      const todayRow = (data as DailyActivity[]).find(r => r.date === today);
      if (todayRow) setTodayData(todayRow);
      const totals: any = {};
      for (const a of ACTIVITIES) {
        totals[a.key] = (data as DailyActivity[]).reduce((sum, r) => sum + (r[a.key] as number || 0), 0);
      }
      setMonthTotals(totals);
    }
    setLoading(false);
  }, [supabase, userId, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const increment = async (key: ActivityKey) => {
    setSaving(key);
    const newVal = ((todayData[key] as number) || 0) + 1;
    const updated = { ...todayData, [key]: newVal };
    setTodayData(updated);
    setMonthTotals(prev => ({ ...prev, [key]: ((prev[key] as number) || 0) + 1 }));
    await supabase.from("daily_activities").upsert({ ...updated, updated_at: new Date().toISOString() } as any, { onConflict: "user_id,date" });
    setSaving(null);
  };

  const decrement = async (key: ActivityKey) => {
    const cur = (todayData[key] as number) || 0;
    if (cur <= 0) return;
    setSaving(key);
    const updated = { ...todayData, [key]: cur - 1 };
    setTodayData(updated);
    setMonthTotals(prev => ({ ...prev, [key]: Math.max(0, ((prev[key] as number) || 0) - 1) }));
    await supabase.from("daily_activities").upsert({ ...updated, updated_at: new Date().toISOString() } as any, { onConflict: "user_id,date" });
    setSaving(null);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>;

  return (
    <div className="h-full overflow-y-auto scroll-touch pb-4">
      {/* Header */}
      <div className="mx-4 mt-4 mb-3 rounded-3xl p-4 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #047857, #10b981)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #fff, transparent)", transform: "translate(30%, -30%)" }} />
        <p className="text-jade-100 text-sm font-medium">{format(new Date(), "MMMM yyyy")}</p>
        <p className="font-display font-bold text-white text-lg mt-1">Activity Tracker</p>
      </div>

      {/* Monthly totals */}
      <div className="mx-4 mb-3 card p-4">
        <p className="section-title mb-3">{format(new Date(), "MMMM")} Totals</p>
        <div className="grid grid-cols-4 gap-2">
          {ACTIVITIES.map(a => (
            <div key={a.key} className="text-center">
              <p className="text-xl font-display font-bold text-navy-900">{(monthTotals[a.key] as number) || 0}</p>
              <p className="text-xs text-navy-400 leading-tight">{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tap grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {ACTIVITIES.map(a => {
          const count = (todayData[a.key] as number) || 0;
          return (
            <div key={a.key} className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: a.gradient }}>
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-20"
                style={{ background: "radial-gradient(circle, #fff, transparent)", transform: "translate(30%, -30%)" }} />
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl">{a.emoji}</span>
                <span className="text-4xl font-display font-bold">{count}</span>
              </div>
              <p className="text-white/80 text-xs font-semibold mb-3">{a.label}</p>
              <div className="flex gap-2">
                <button onClick={() => decrement(a.key)} disabled={count === 0}
                  className="flex-1 h-10 rounded-xl bg-white/20 text-white font-bold text-xl disabled:opacity-30 active:scale-95 transition-transform">−</button>
                <button onClick={() => increment(a.key)}
                  className="flex-1 h-10 rounded-xl bg-white/30 text-white font-bold text-xl active:scale-95 transition-transform flex items-center justify-center">
                  {saving === a.key ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "+"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
