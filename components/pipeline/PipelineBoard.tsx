"use client";
import { useEffect, useState, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase";
import { Contact } from "@/lib/database.types";
import { format } from "date-fns";
import toast from "react-hot-toast";

const STAGES = ["Marketing", "Processing", "In Contract", "Other"] as const;
type Stage = typeof STAGES[number];

const STAGE_CONFIG: Record<Stage, { gradient: string; light: string; ring: string }> = {
  Marketing:    { gradient: "linear-gradient(135deg, #6171f5, #8196fa)", light: "#f0f4ff", ring: "#c7d6fe" },
  Processing:   { gradient: "linear-gradient(135deg, #f59e0b, #fcd34d)", light: "#fffbeb", ring: "#fde68a" },
  "In Contract":{ gradient: "linear-gradient(135deg, #10b981, #34d399)", light: "#ecfdf5", ring: "#a7f3d0" },
  Other:        { gradient: "linear-gradient(135deg, #64748b, #94a3b8)", light: "#f8fafc", ring: "#e2e8f0" },
};

const PRIORITY_DOT: Record<string, string> = { HIGH: "#f94021", MED: "#f59e0b", LOW: "#6171f5" };

export default function PipelineBoard({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Contact | null>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from("contacts").select("*").eq("user_id", userId).order("name");
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleDragStart = (e: DragStartEvent) => setActive(contacts.find(c => c.id === e.active.id) || null);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const contactId = a.id as string;
    const newStage = over.id as Stage;
    if (!STAGES.includes(newStage)) return;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || contact.pipeline_stage === newStage) return;
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipeline_stage: newStage } : c));
    const { error } = await supabase.from("contacts").update({ pipeline_stage: newStage, updated_at: new Date().toISOString() } as any).eq("id", contactId);
    if (error) { toast.error("Failed to move"); setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipeline_stage: contact.pipeline_stage } : c)); }
  };

  const grouped = STAGES.reduce((acc, s) => { acc[s] = contacts.filter(c => c.pipeline_stage === s); return acc; }, {} as Record<Stage, Contact[]>);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto scroll-touch">
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${STAGES.length * 270}px` }}>
          {STAGES.map(stage => (
            <KanbanCol key={stage} stage={stage} contacts={grouped[stage]} config={STAGE_CONFIG[stage]} />
          ))}
        </div>
      </div>
      <DragOverlay>
        {active && <ContactCard contact={active} config={STAGE_CONFIG[active.pipeline_stage as Stage] || STAGE_CONFIG.Other} />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanCol({ stage, contacts, config }: { stage: Stage; contacts: Contact[]; config: typeof STAGE_CONFIG[Stage] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-6 px-3 rounded-full text-white text-xs font-display font-bold flex items-center gap-1.5"
          style={{ background: config.gradient }}>
          {stage} <span className="opacity-80">{contacts.length}</span>
        </div>
      </div>
      <div ref={setNodeRef} className="flex-1 space-y-2 rounded-2xl p-2 min-h-48 transition-all duration-150"
        style={{ background: isOver ? config.light : "#f1f5f9", outline: isOver ? `2px solid ${config.ring}` : "none" }}>
        <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {contacts.map(c => <ContactCard key={c.id} contact={c} config={config} />)}
        </SortableContext>
        {contacts.length === 0 && <div className="flex items-center justify-center h-16 text-slate-300 text-xs">Drop here</div>}
      </div>
    </div>
  );
}

function ContactCard({ contact: c, config }: { contact: Contact; config: typeof STAGE_CONFIG[Stage] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const initials = c.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const pDot = PRIORITY_DOT[c.priority_score || ""] || null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-white rounded-xl border border-navy-100 p-3 cursor-grab active:cursor-grabbing select-none shadow-card">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-display font-bold"
          style={{ background: config.gradient }}>{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {pDot && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pDot }} />}
            <p className="text-sm font-display font-semibold text-navy-900 truncate">{c.name}</p>
          </div>
          {c.campaign && <p className="text-xs text-navy-400 truncate mt-0.5">{c.campaign}</p>}
          {c.credit_score && <p className="text-xs text-navy-300 mt-0.5">Credit: {c.credit_score}</p>}
        </div>
      </div>
    </div>
  );
}
