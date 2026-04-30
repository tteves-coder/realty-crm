"use client";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { syncNextStepTask } from "@/lib/tasks";
import toast from "react-hot-toast";

export function useNextStep(contactId: string, userId: string) {
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const saveNextStep = useCallback(
    async (nextSteps: string, additionalUpdates?: Record<string, unknown>) => {
      setSaving(true);
      try {
        // Save to contact
        const { error } = await supabase
          .from("contacts")
          .update({
            next_steps: nextSteps,
            updated_at: new Date().toISOString(),
            ...additionalUpdates,
          } as any)
          .eq("id", contactId);

        if (error) throw error;

        // Auto-sync to task
        if (nextSteps?.trim()) {
          await syncNextStepTask(contactId, userId, nextSteps, 1);
        }

        toast.success("Saved & task updated!");
      } catch {
        toast.error("Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [contactId, userId, supabase]
  );

  return { saveNextStep, saving };
}
