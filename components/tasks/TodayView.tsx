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
