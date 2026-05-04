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
import { format, parseISO, isValid, isToday, isPast } from "date-fns";
import toast from "react-hot-toast";

const STAGES = ["Marketing", "Processing", "In Contract", "Other"] as const;
type Stage = (typeof STAGES)[number];

// v3 design system — navy / coral / gold / jade
const STAGE_STYLES: Record<
  Stage,
  { dot: string; header: string; ring: string; hoverBg: string }
> = {
  Marketing: {
    dot: "bg-navy-500",
    header: "text-navy-800",
    ring: "ring-navy-200",
    hoverBg: "bg-navy-50",
  },
  Processing: {
    dot: "bg-gold-500",
    header: "text-gold-700",
    ring: "ring-gold-200",
    hoverBg: "bg-gold-50",
  },
  "In Contract": {
    dot: "bg-jade-500",
    header: "text-jade-700",
    ring: "ring-jade-200",
    hoverBg: "bg-jade-50",
  },
  Other: {
    dot: "bg-navy-300",
    header: "text-navy-600",
    ring: "ring-navy-100",
    hoverBg: "bg-navy-50",
  },
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: contactData, error: contactErr } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId);

      if (contactErr) throw contactErr;

      const allContacts = contactData ?? [];
      setContacts(allContacts);

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

      if (taskErr) console.warn("Task load issue:", taskErr.message);

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

    // optimistic update
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
            ? { ...c, pipeline_stage: contact.pipeline_stage }
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
      <div className="flex items-center justify-center h-full py-20">
        <svg
          className="animate-spin h-8 w-8 text-coral-500"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="font-display font-semibold text-coral-600">
          Failed to load pipeline
        </p>
        <p className="text-sm text-navy-400 mt-2">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-gradient-navy text-white rounded-lg font-semibold shadow-card hover:shadow-glow transition-shadow"
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
      <div className="h-full overflow-x-auto scroll-touch">
        <div
          className="flex gap-4 p-4 h-full"
          style={{ minWidth: `${STAGES.length * 290}px` }}
        >
          {STAGES.map((stage) => (
            <KanbanCol
              key={stage}
              stage={stage}
              contacts={grouped[stage]}
              taskMap={taskMap}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {active && (
          <div className="p-3 bg-white shadow-card-lg rounded-xl border border-navy-100 font-display font-semibold text-navy-900">
            {active.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanCol({
  stage,
  contacts,
  taskMap,
}: {
  stage: Stage;
  contacts: Contact[];
  taskMap: Record<string, Task | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const style = STAGE_STYLES[stage];

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${style.dot}`} />
        <h2
          className={`text-sm font-display font-semibold ${style.header}`}
        >
          {stage}
        </h2>
        <span className="ml-auto text-xs font-medium text-navy-400 bg-white px-2 py-0.5 rounded-full border border-navy-100">
          {contacts.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl p-2 min-h-[250px] transition-colors duration-150 ${
          isOver
            ? `${style.hoverBg} ring-2 ${style.ring}`
            : "bg-white/60 border border-navy-100"
        }`}
      >
        <SortableContext
          items={contacts.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {contacts.map((c) => (
            <ContactCard key={c.id} contact={c} task={taskMap[c.id]} />
          ))}
        </SortableContext>

        {contacts.length === 0 && (
          <div className="flex items-center justify-center h-20 text-navy-300 text-xs text-center">
            Drop contacts here
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  task,
}: {
  contact: Contact;
  task: Task | null | undefined;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // task date status
  let dueLabel: string | null = null;
  let dueClass = "text-navy-400";
  if (task?.due_date) {
    const d = parseISO(task.due_date);
    if (isValid(d)) {
      if (isToday(d)) {
        dueLabel = "Due today";
        dueClass = "text-coral-600 font-medium";
      } else if (isPast(d)) {
        dueLabel = `Overdue · ${format(d, "MMM d")}`;
        dueClass = "text-coral-600 font-medium";
      } else {
        dueLabel = format(d, "MMM d");
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // don't navigate if user is dragging
        if (!isDragging) router.push(`/contacts/${contact.id}`);
      }}
      className="p-3 rounded-xl bg-white border border-navy-100 shadow-card hover:shadow-card-lg hover:border-navy-200 transition cursor-pointer touch-none"
    >
      <div className="font-display font-semibold text-navy-900 text-sm truncate">
        {contact.name}
      </div>

      {(contact as any).campaign && (
        <div className="text-xs text-navy-500 mt-0.5 truncate">
          {(contact as any).campaign}
        </div>
      )}

      {task && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`text-xs ${dueClass}`}>
            {dueLabel || task.description}
          </span>
        </div>
      )}
    </div>
  );
}
