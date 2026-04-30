import { createClient } from "./supabase";

export interface TaskWithContact {
  id: string;
  contact_id: string;
  user_id: string;
  description: string;
  due_date: string;
  status: string;
  created_at: string;
  contacts?: {
    name: string;
    phone: string | null;
    pipeline_stage: string;
    campaign: string | null;
  } | null;
}

export async function getTodayTasks(userId: string): Promise<TaskWithContact[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("tasks")
    .select("*, contacts(name, phone, pipeline_stage, campaign)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("due_date", today)
    .order("created_at");
  return (data as TaskWithContact[]) || [];
}

export async function getOverdueTasks(userId: string): Promise<TaskWithContact[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("tasks")
    .select("*, contacts(name, phone, pipeline_stage, campaign)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("due_date", today)
    .order("due_date");
  return (data as TaskWithContact[]) || [];
}

export async function getUpcomingTasks(
  userId: string,
  days = 14
): Promise<TaskWithContact[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureDate = future.toISOString().split("T")[0];

  const { data } = await supabase
    .from("tasks")
    .select("*, contacts(name, phone, pipeline_stage, campaign)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gt("due_date", today)
    .lte("due_date", futureDate)
    .order("due_date");
  return (data as TaskWithContact[]) || [];
}

export async function getTasksForContact(contactId: string): Promise<TaskWithContact[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("contact_id", contactId)
    .order("due_date");
  return (data as TaskWithContact[]) || [];
}

// Upsert a task for a contact based on next_steps text
export async function syncNextStepTask(
  contactId: string,
  userId: string,
  nextSteps: string | null,
  dueDateDays = 1
): Promise<void> {
  const supabase = createClient();
  if (!nextSteps?.trim()) return;

  // Check for existing pending task
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "pending")
    .limit(1);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDateDays);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  if (existing && existing.length > 0) {
    // Update existing task
    await supabase
      .from("tasks")
      .update({ description: nextSteps, due_date: dueDateStr })
      .eq("id", (existing[0] as any).id);
  } else {
    // Create new task
    await supabase.from("tasks").insert({
      contact_id: contactId,
      user_id: userId,
      description: nextSteps,
      due_date: dueDateStr,
      status: "pending",
    } as any);
  }
}
