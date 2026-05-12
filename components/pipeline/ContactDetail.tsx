"use client";
import ActiveTaskCard from "@/components/contacts/ActiveTaskCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Contact,
  TouchType,
  ContactType,
  PartnerCategory,
  PartnerPipelineStage,
  PreferredContactMethod,
  PARTNER_CATEGORIES,
  PARTNER_PIPELINE_STAGES,
  PREFERRED_CONTACT_METHODS,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase";
import { useNextStep } from "@/hooks/use-next-step";
import { format, parseISO, isValid, isPast, isToday } from "date-fns";
import toast from "react-hot-toast";

const TOUCH_TYPES: { type: TouchType; label: string; emoji: string; color: string }[] = [
  { type: "call",         label: "Called",       emoji: "📞", color: "#6171f5" },
  { type: "text",         label: "Texted",       emoji: "💬", color: "#10b981" },
  { type: "email",        label: "Emailed",      emoji: "📧", color: "#8b5cf6" },
  { type: "met",          label: "Met",          emoji: "☕", color: "#0d9488" },
  { type: "sent_content", label: "Sent Content", emoji: "📤", color: "#f59e0b" },
  { type: "postcard",     label: "Postcard",     emoji: "📮", color: "#f94021" },
  { type: "bombbomb",     label: "BombBomb",     emoji: "🎥", color: "#ec4899" },
];

const STAGE_GRAD: Record<string, string> = {
  Marketing: "linear-gradient(135deg, #6171f5, #8196fa)",
  Processing: "linear-gradient(135deg, #f59e0b, #fcd34d)",
  "In Contract": "linear-gradient(135deg, #10b981, #34d399)",
  Other: "linear-gradient(135deg, #64748b, #94a3b8)",
};

// Partner-type gradient (used when contact_type = Partner)
const PARTNER_GRAD = "linear-gradient(135deg, #0d9488, #2dd4bf)";

const ALL_CAMPAIGNS = ["8x8 Buyer", "Seller Nurture", "Past Client", "Absentee Owner", "Other"];
const ALL_STAGES = ["Marketing", "Processing", "In Contract", "Other"];
const CONTACT_TYPES: ContactType[] = ["Client", "Partner", "Lead"];

type Task = { id: string; description: string; due_date: string; status: string };
type TouchLog = { id: string; touch_type: string; notes: string | null; touched_at: string };
type PartnerOption = { id: string; name: string; partner_category: string | null };

export default function ContactDetail({ contact: initial, userId }: { contact: Contact; userId: string }) {
  const [contact, setContact] = useState(initial);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [touchLogs, setTouchLogs] = useState<TouchLog[]>([]);
  const [nextSteps, setNextSteps] = useState(initial.next_steps || "");
  const [campaign, setCampaign] = useState(initial.campaign || "");
  const [stage, setStage] = useState(initial.pipeline_stage || "Marketing");
  const [priority, setPriority] = useState(initial.priority_score || "");
  const [mlUpdate, setMlUpdate] = useState(initial.ml_update_needed || false);

  // Week 2: editable contact type + new fields
  const [contactType, setContactType] = useState<ContactType>(initial.contact_type || "Client");
  const [firm, setFirm] = useState(initial.firm || "");
  const [roleTitle, setRoleTitle] = useState(initial.role_title || "");
  const [partnerCategory, setPartnerCategory] = useState<PartnerCategory | "">(
    (initial.partner_category as PartnerCategory) || ""
  );
  const [nicheFitNotes, setNicheFitNotes] = useState(initial.niche_fit_notes || "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url || "");
  const [activeSince, setActiveSince] = useState(initial.active_since || "");
  const [partnerStage, setPartnerStage] = useState<PartnerPipelineStage>(
    (initial.partner_pipeline_stage as PartnerPipelineStage) || "Prospecting"
  );
  const [birthday, setBirthday] = useState(initial.birthday || "");
  const [preferredContact, setPreferredContact] = useState<PreferredContactMethod | "">(
    (initial.preferred_contact_method as PreferredContactMethod) || ""
  );
  const [referredByPartnerId, setReferredByPartnerId] = useState(initial.referred_by_partner_id || "");

  // Partners list for Referred By dropdown
  const [partners, setPartners] = useState<PartnerOption[]>([]);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "tasks">("overview");
  const router = useRouter();
  const supabase = createClient();
  const { saveNextStep, saving } = useNextStep(contact.id, userId);

  useEffect(() => {
    supabase.from("tasks").select("*").eq("contact_id", contact.id)
      .order("due_date").then(({ data }) => setTasks((data as Task[]) || []));
    supabase.from("touch_logs").select("*").eq("contact_id", contact.id)
      .order("touched_at", { ascending: false }).limit(20)
      .then(({ data }) => setTouchLogs((data as TouchLog[]) || []));
  }, [contact.id, supabase]);

  // Load partners list when this is a Client/Lead (for Referred By dropdown)
  useEffect(() => {
    if (contactType === "Partner") return;
    supabase
      .from("contacts")
      .select("id, name, partner_category")
      .eq("user_id", userId)
      .eq("contact_type", "Partner")
      .neq("id", contact.id) // can't refer to self
      .order("name")
      .then(({ data }) => {
        if (data) setPartners(data as PartnerOption[]);
      });
  }, [contactType, supabase, userId, contact.id]);

  const logTouch = async (type: TouchType) => {
    const { data } = await supabase.from("touch_logs").insert({
      contact_id: contact.id, user_id: userId,
      touch_type: type, touched_at: new Date().toISOString(),
    } as any).select().single();
    if (data) {
      setTouchLogs(prev => [data as TouchLog, ...prev]);
      await supabase.from("contacts").update({ last_contacted: format(new Date(), "yyyy-MM-dd") } as any).eq("id", contact.id);
      toast.success(`${TOUCH_TYPES.find(t => t.type === type)?.label} logged!`);
    }
  };

  // Save everything (Week 2: includes partner + common fields)
  const handleSave = async () => {
    const updates: any = {
      contact_type: contactType,
      campaign,
      priority_score: priority || null,
      ml_update_needed: mlUpdate,
      birthday: birthday || null,
      preferred_contact_method: preferredContact || null,
      updated_at: new Date().toISOString(),
    };

    if (contactType === "Partner") {
      updates.firm = firm.trim() || null;
      updates.role_title = roleTitle.trim() || null;
      updates.partner_category = partnerCategory || null;
      updates.niche_fit_notes = nicheFitNotes.trim() || null;
      updates.linkedin_url = linkedinUrl.trim() || null;
      updates.active_since = activeSince || null;
      updates.partner_pipeline_stage = partnerStage;
      // Don't clear referred_by here — preserve in case type was switched back
    } else {
      updates.pipeline_stage = stage;
      updates.referred_by_partner_id = referredByPartnerId || null;
    }

    // Always save next_steps via the existing hook (for task auto-creation)
    await saveNextStep(nextSteps, updates);

    setContact(prev => ({ ...prev, ...updates, next_steps: nextSteps } as Contact));
    toast.success("Saved!");
  };

  const completeTask = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "completed" } : t));
    toast.success("Task done!");
  };

  const addTask = async () => {
    if (!newTask.trim() || !newTaskDate) return;
    const { data } = await supabase.from("tasks").insert({
      contact_id: contact.id, user_id: userId,
      description: newTask, due_date: newTaskDate, status: "pending",
    } as any).select().single();
    if (data) {
      setTasks(prev => [...prev, data as Task]);
      setNewTask(""); setNewTaskDate(""); setShowAddTask(false);
      toast.success("Task added!");
    }
  };

  const initials = contact.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const doneTasks = tasks.filter(t => t.status === "completed");
  const isPartner = contactType === "Partner";
  const headerGradient = isPartner ? PARTNER_GRAD : (STAGE_GRAD[contact.pipeline_stage] || STAGE_GRAD.Other);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="safe-top" style={{ background: "linear-gradient(135deg, #13144a, #1e1f6b)" }}>
        <div className="px-4 pt-2 pb-4">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-white/60 text-sm mb-3 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-display font-bold text-xl flex-shrink-0"
              style={{ background: headerGradient }}>{initials}</div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-white text-xl leading-tight">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">
                  {contactType}{isPartner && partnerCategory ? ` · ${partnerCategory}` : ""}
                </span>
                {contact.priority_score && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/15 text-white">{contact.priority_score}</span>
                )}
                {!isPartner && <span className="text-white/60 text-xs">{contact.pipeline_stage}</span>}
                {contact.city && <span className="text-white/60 text-xs">· {contact.city}, {contact.state}</span>}
              </div>
            </div>
          </div>

          {/* Quick contact row */}
          <div className="flex gap-2 mt-4">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/15 text-white text-sm font-semibold">
                <span>📞</span> Call
              </a>
            )}
            {contact.phone && (
              <a href={`sms:${contact.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/15 text-white text-sm font-semibold">
                <span>💬</span> Text
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/15 text-white text-sm font-semibold">
                <span>📧</span> Email
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/10">
          {(["overview", "history", "tasks"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? "text-white border-b-2 border-white" : "text-white/40"}`}>
              {tab} {tab === "tasks" && pendingTasks.length > 0 ? `(${pendingTasks.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-touch">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="px-4 py-4 space-y-4">
            <ActiveTaskCard
              task={tasks.find(t => t.status === "pending") || null}
              onUpdated={async () => {
                const { data } = await supabase
                  .from("tasks")
                  .select("*")
                  .eq("contact_id", contact.id)
                  .order("due_date");
                setTasks((data as Task[]) || []);
              }}
            />

            {/* Property data (Client/Lead only, only if data exists) */}
            {!isPartner && (contact.credit_score || contact.equity_flag !== null || contact.mortgage_amount) && (
              <div className="card p-4">
                <p className="section-title mb-3">Property Info</p>
                <div className="grid grid-cols-3 gap-3">
                  {contact.credit_score && (
                    <div className="text-center">
                      <p className="text-xs text-navy-400">Credit Score</p>
                      <p className="font-display font-bold text-navy-900 text-sm mt-0.5">{contact.credit_score}</p>
                    </div>
                  )}
                  {contact.equity_flag !== null && (
                    <div className="text-center">
                      <p className="text-xs text-navy-400">Equity</p>
                      <p className={`font-display font-bold text-sm mt-0.5 ${contact.equity_flag ? "text-jade-600" : "text-coral-600"}`}>
                        {contact.equity_flag ? "YES ✓" : "NO"}
                      </p>
                    </div>
                  )}
                  {contact.mortgage_amount && (
                    <div className="text-center">
                      <p className="text-xs text-navy-400">Mortgage</p>
                      <p className="font-display font-bold text-navy-900 text-sm mt-0.5">{contact.mortgage_amount}</p>
                    </div>
                  )}
                </div>
                {contact.address && (
                  <p className="text-xs text-navy-500 mt-3 pt-3 border-t border-navy-100">
                    📍 {[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                  </p>
                )}
                {contact.year_purchased && (
                  <p className="text-xs text-navy-400 mt-1">Purchased: {contact.year_purchased}</p>
                )}
              </div>
            )}

            {/* PARTNER INFO CARD (Partner only) */}
            {isPartner && (
              <div className="card p-4 space-y-3">
                <p className="section-title">Partner Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Firm</label>
                    <input value={firm} onChange={e => setFirm(e.target.value)}
                      className="input text-sm py-2" placeholder="Firm or company" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Role</label>
                    <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
                      className="input text-sm py-2" placeholder="Title" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Category</label>
                  <select value={partnerCategory}
                    onChange={e => setPartnerCategory(e.target.value as PartnerCategory | "")}
                    className="input text-sm py-2">
                    <option value="">—</option>
                    {PARTNER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Niche Fit Notes</label>
                  <textarea value={nicheFitNotes} onChange={e => setNicheFitNotes(e.target.value)}
                    rows={2} className="input text-sm resize-none"
                    placeholder="Why they fit your niche" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">LinkedIn</label>
                    <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                      className="input text-sm py-2" placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Active Since</label>
                    <input type="date" value={activeSince} onChange={e => setActiveSince(e.target.value)}
                      className="input text-sm py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Partner Stage</label>
                  <select value={partnerStage}
                    onChange={e => setPartnerStage(e.target.value as PartnerPipelineStage)}
                    className="input text-sm py-2">
                    {PARTNER_PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="card p-4">
              <p className="section-title mb-2">Next Steps → Auto-creates Task</p>
              <textarea
                value={nextSteps}
                onChange={e => setNextSteps(e.target.value)}
                placeholder="What's the next action? (Saves as a task due tomorrow)"
                className="input text-sm resize-none"
                rows={3}
              />
              {contact.notes && (
                <div className="mt-3 p-3 bg-navy-50 rounded-xl">
                  <p className="text-xs text-navy-400 font-semibold mb-1">Notes</p>
                  <p className="text-xs text-navy-600">{contact.notes}</p>
                </div>
              )}
            </div>

            {/* Contact Settings */}
            <div className="card p-4 space-y-3">
              <p className="section-title">Contact Settings</p>
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1">Contact Type</label>
                <select value={contactType}
                  onChange={e => setContactType(e.target.value as ContactType)}
                  className="input text-sm py-2">
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="input text-sm py-2">
                    <option value="">None</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MED">MED</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                {!isPartner && (
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Pipeline</label>
                    <select value={stage} onChange={e => setStage(e.target.value)} className="input text-sm py-2">
                      {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {!isPartner && (
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Campaign</label>
                  <select value={campaign} onChange={e => setCampaign(e.target.value)} className="input text-sm py-2">
                    <option value="">No campaign</option>
                    {ALL_CAMPAIGNS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Common: birthday + preferred contact */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Birthday</label>
                  <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                    className="input text-sm py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Preferred Contact</label>
                  <select value={preferredContact}
                    onChange={e => setPreferredContact(e.target.value as PreferredContactMethod | "")}
                    className="input text-sm py-2">
                    <option value="">—</option>
                    {PREFERRED_CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Referred By (Clients & Leads only) */}
              {!isPartner && (
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">
                    Referred By <span className="text-navy-300 text-[10px]">(optional)</span>
                  </label>
                  <select value={referredByPartnerId}
                    onChange={e => setReferredByPartnerId(e.target.value)}
                    className="input text-sm py-2">
                    <option value="">— Not referred by a partner</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.partner_category ? ` · ${p.partner_category}` : ""}
                      </option>
                    ))}
                  </select>
                  {partners.length === 0 && (
                    <p className="text-[11px] text-navy-400 mt-1">No partners yet.</p>
                  )}
                </div>
              )}

              <button onClick={() => setMlUpdate(!mlUpdate)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${mlUpdate ? "border-gold-400 bg-gold-50" : "border-navy-100"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${mlUpdate ? "bg-gold-400 border-gold-400" : "border-navy-300"}`}>
                  {mlUpdate && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span className="text-sm font-semibold text-navy-700">Flag: Update Market Leader</span>
              </button>
            </div>

            {/* Log touch */}
            <div className="card p-4">
              <p className="section-title mb-3">Log a Touch</p>
              <div className="grid grid-cols-3 gap-2">
                {TOUCH_TYPES.map(t => (
                  <button key={t.type} onClick={() => logTouch(t.type)}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 active:scale-95 transition-all text-xs font-semibold"
                    style={{ background: `${t.color}15`, color: t.color, borderColor: `${t.color}30` }}>
                    <span className="text-lg">{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? "Saving..." : "Save & Sync Task"}
            </button>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="px-4 py-4">
            {touchLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-navy-400 text-sm">No touch history yet.</p>
                <p className="text-navy-300 text-xs mt-1">Log a call, text, or email from the Overview tab.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {touchLogs.map(log => {
                  const tt = TOUCH_TYPES.find(t => t.type === log.touch_type);
                  return (
                    <div key={log.id} className="card p-3 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: `${tt?.color || "#6171f5"}15` }}>{tt?.emoji || "📌"}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy-900 text-sm">{tt?.label || log.touch_type}</p>
                        {log.notes && <p className="text-xs text-navy-500 mt-0.5">{log.notes}</p>}
                        <p className="text-xs text-navy-300 mt-0.5">{format(new Date(log.touched_at), "MMM d, yyyy · h:mm a")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="px-4 py-4 space-y-3">
            {showAddTask ? (
              <div className="card p-4 space-y-2">
                <p className="section-title">New Task</p>
                <input value={newTask} onChange={e => setNewTask(e.target.value)}
                  placeholder="Task description..." className="input text-sm" />
                <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} className="input text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAddTask(false)} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
                  <button onClick={addTask} className="btn-primary flex-1 text-sm py-2">Add Task</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddTask(true)} className="btn-secondary w-full">
                + Add Task
              </button>
            )}

            {pendingTasks.length > 0 && (
              <div>
                <p className="section-title mb-2">Pending</p>
                <div className="space-y-2">
                  {pendingTasks.map(t => {
                    const d = parseISO(t.due_date);
                    const overdue = isValid(d) && isPast(d) && !isToday(d);
                    const today = isValid(d) && isToday(d);
                    return (
                      <div key={t.id} className={`card p-3 flex items-start gap-3 ${overdue ? "border-coral-200 bg-coral-50/30" : today ? "border-jade-200 bg-jade-50/20" : ""}`}>
                        <button onClick={() => completeTask(t.id)}
                          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors ${overdue ? "border-coral-400" : "border-navy-300 hover:border-navy-600"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy-900">{t.description}</p>
                          <p className={`text-xs mt-0.5 ${overdue ? "text-coral-600 font-semibold" : today ? "text-jade-600 font-semibold" : "text-navy-400"}`}>
                            {overdue ? "⚠ Overdue · " : today ? "✓ Due today · " : ""}{format(d, "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {doneTasks.length > 0 && (
              <div>
                <p className="section-title mb-2 text-jade-600">Completed</p>
                <div className="space-y-2 opacity-60">
                  {doneTasks.map(t => (
                    <div key={t.id} className="card p-3 flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-jade-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-navy-500 line-through">{t.description}</p>
                        <p className="text-xs text-navy-300 mt-0.5">{format(parseISO(t.due_date), "MMM d")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-navy-400 text-sm">No tasks yet.</p>
                <p className="text-navy-300 text-xs mt-1">Add a next step from Overview to auto-create one.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
