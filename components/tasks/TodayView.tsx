import React from "react";
import { ui } from "@/components/uiStyles";

export default function TodayView({ userId }: { userId: string }) {
  // NOTE: Replace these with your real Supabase/fetched data hooks if needed
  const stats = [
    { label: "New Leads", value: 12 },
    { label: "Active Deals", value: 8 },
    { label: "Tasks Today", value: 5 },
    { label: "Pipeline Value", value: "$1.2M" },
  ];

  const tasks = [
    { title: "Call seller about offer", priority: "High" },
    { title: "Send disclosure docs", priority: "Medium" },
    { title: "Follow up escrow officer", priority: "High" },
    { title: "Confirm appraisal date", priority: "Low" },
  ];

  const pipeline = [
    { stage: "New Leads", count: 6 },
    { stage: "Active Search", count: 4 },
    { stage: "In Escrow", count: 3 },
    { stage: "Closing", count: 1 },
  ];

  const getPriorityClass = (priority: string) => {
    if (priority === "High") return ui.badge.hot;
    if (priority === "Medium") return ui.badge.warm;
    return ui.badge.cool;
  };

  return (
    <div className={ui.page}>
      {/* HEADER */}
      <div className={ui.header}>
        <div>
          <h1 className={ui.title}>Today</h1>
          <p className={ui.subtitle}>Your real estate pipeline overview</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className={`${ui.card} col-span-3 ${ui.cardHover}`}>
            <p className={ui.textMuted}>{s.label}</p>
            <p className="text-2xl font-semibold mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-4">
        {/* TASKS */}
        <div className={`${ui.card} col-span-7`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Tasks</h2>
          </div>

          <div className="space-y-3">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                <span className="text-sm">{task.title}</span>
                <span className={getPriorityClass(task.priority)}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PIPELINE */}
        <div className={`${ui.card} col-span-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Pipeline</h2>
          </div>

          <div className="space-y-3">
            {pipeline.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                <span className="text-sm text-white/80">{p.stage}</span>
                <span className="text-white/60 font-medium">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
