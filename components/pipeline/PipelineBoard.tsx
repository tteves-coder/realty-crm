"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import { createClient } from "@/lib/supabase";
import { Contact } from "@/lib/database.types";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";

const STAGES = ["Marketing", "Processing", "In Contract", "Other"] as const;
type Stage = (typeof STAGES)[number];

const getStageStyle = (stage: string) => {
  const s = stage.toLowerCase();

  if (s.includes("marketing")) {
    return "bg-blue-500/10 text-blue-300 border-blue-500/30";
  }

  if (s.includes("processing")) {
    return "bg-orange-500/10 text-orange-300 border-orange-500/30";
  }

  if (s.includes("contract")) {
    return "bg-green-500/10 text-green-300 border-green-500/30";
  }

  return "bg-white/5 text-white/60 border-white/10";
};
const PRIORITY_DOT: Record<string, string> = {
  HIGH: "#f94021",
  MED: "#f59e0b",
  LOW: "#6171f5",
};

type Task = {
  id: string;
  description: string;
  due_date: string;
};

export default function PipelineBoard({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, Task | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Contact | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  // ✅ CLEAN FETCH (SAFE FOR VERCEL)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // CONTACTS
      const { data: contactData, error: contactErr } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId);

      if (contactErr) throw contactErr;

      const allContacts = contactData ?? [];
      setContacts(allContacts);

      // TASKS (safe even if RLS blocks or empty)
      const contactIds = allContacts.map((c) => c.id);

      if (contactIds.length === 0) {
        setTaskMap({});
        return;
      }

      const { data: taskData, error: taskErr } = await supabase
        .from("tasks")
        .select("id, contact_id, description, due_date")
        .in("contact_id", contactIds)
        .eq("status", "pending");

      if (taskErr) {
        console.warn("Task load issue:", taskErr.message);
      }

      const tasks = taskData ?? [];

      const map: Record<string, Task | null> = {};

      for (const t of tasks) {
        if (!map[t.contact_id]) {
          map[t.contact_id] = {
            id: t.id,
            description: t.description,
            due_date: t.due_date,
          };
        }
      }

      setTaskMap(map);
    } catch (e: any) {
      console.error("Pipeline error:", e);
      setError(e?.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = (e: DragStartEvent) => {
    const found = contacts.find((c) => c.id === e.active.id);
    setActive(found || null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActive(null);

    const { active: a, over } = e;
    if (!over) return;

    const contactId = a.id as string;
    const newStage = over.id as Stage;

    if (!STAGES.includes(newStage)) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.pipeline_stage === newStage) return;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, pipeline_stage: newStage } : c
      )
    );

    const { error } = await supabase
      .from("contacts")
      .update({
        pipeline_stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    if (error) {
      toast.error("Move failed");
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, pipeline_stage: contact!.pipeline_stage }
            : c
        )
      );
    }
  };

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = contacts.filter((c) => c.pipeline_stage === stage);
    return acc;
  }, {} as Record<Stage, Contact[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-semibold">Failed to load pipeline</p>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-black text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto">
        {STAGES.map((stage) => (
          <KanbanCol
            key={stage}
            stage={stage}
            contacts={grouped[stage]
            taskMap={taskMap}
          />
        ))}
      </div>

      <DragOverlay>
        {active && (
          <div className="p-3 bg-white shadow rounded">
            {active.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanCol({ stage, contacts, config, taskMap }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="w-64 flex-shrink-0">
      <div className={`mb-2 px-2 py-1 rounded-full border text-xs w-fit ${getStageStyle(stage)}`}>
  {stage}
</div>

      <div
        ref={setNodeRef}
        className="p-2 rounded min-h-[200px]"
        className={`p-2 rounded min-h-[200px] border ${isOver ? "border-white/30 bg-white/5" : "border-white/10 bg-white/5"}`}
      >
        {contacts.map((c: Contact) => (
          <ContactCard key={c.id} contact={c} task={taskMap[c.id]} />
        ))}
      </div>
    </div>
  );
}

function ContactCard({ contact, task }: any) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/contacts/${contact.id}`)}
      className="p-2 bg-white mb-2 rounded shadow cursor-pointer"
    >
      <div className="font-medium">{contact.name}</div>

      {task && (
        <div className="text-xs text-gray-500">
          {task.description}
        </div>
      )}
    </div>
  );
}
