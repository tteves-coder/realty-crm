"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { format, parseISO, isValid, isPast, isToday } from "date-fns";
import toast from "react-hot-toast";

type Task = {
  id: string;
  description: string;
  due_date: string;
  status: string;
};

/**
 * Active task card for the Overview tab — compact inline version.
 *
 * Surfaces the contact's current pending task (auto-generated from
 * Pipeline / Next Step) with an inline date picker so you can
 * reschedule without leaving Overview or opening the New Task form.
 *
 * Drop this into ContactDetail.tsx inside the OVERVIEW tab block,
 * right under the "Next Step" card.
 */
export default function ActiveTaskCard({
  task,
  onUpdated,
}: {
  task: Task | null;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  if (!task) {
    return (
      <div className="card p-4">
        <p className="section-title mb-2">Active Task</p>
        <p className="text-sm text-navy-400">
          No pending task. Set a Next Step to auto-create one.
        </p>
      </div>
    );
  }

  const due = parseISO(task.due_date);
  const valid = isValid(due);
  const overdue = valid && isPast(due) && !isToday(due);
  const today = valid && isToday(due);

  const dueLabelClass = overdue
    ? "text-coral-600"
    : today
    ? "text-gold-700"
    : "text-navy-500";
  const dueLabel = !valid
    ? "No date"
    : overdue
    ? `Overdue · ${format(due, "MMM d")}`
    : today
    ? "Due today"
    : format(due, "MMM d, yyyy");

  // value for <input type="date"> — needs YYYY-MM-DD
  const inputValue = valid ? format(due, "yyyy-MM-dd") : "";

  async function updateDueDate(newDateISO: string) {
    if (!newDateISO || !task) return;
    setSaving(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        due_date: newDateISO,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    setSaving(false);

    if (error) {
      console.error("Update due date failed:", error);
      toast.error("Couldn't update due date");
      return;
    }

    toast.success("Due date updated");
    onUpdated();
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!v) return;
    updateDueDate(v);
  }

  async function completeTask() {
    if (!task) return;
    setCompleting(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    setCompleting(false);

    if (error) {
      toast.error("Couldn't complete task");
      return;
    }
    toast.success("Task completed");
    onUpdated();
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="section-title">Active Task</p>
        <button
          onClick={completeTask}
          disabled={completing}
          className="text-xs font-semibold text-jade-600 hover:text-jade-700 disabled:opacity-50"
        >
          {completing ? "..." : "Mark complete"}
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-navy-900 text-sm">
            {task.description}
          </p>
          <span className={`text-xs font-medium ${dueLabelClass}`}>
            {dueLabel}
          </span>
        </div>

        <input
          type="date"
          value={inputValue}
          onChange={handleDateChange}
          disabled={saving}
          className="text-xs px-2 py-1.5 rounded-lg border border-navy-200 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
