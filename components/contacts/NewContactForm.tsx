"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  ContactType,
  PartnerCategory,
  PartnerPipelineStage,
  PreferredContactMethod,
  PARTNER_CATEGORIES,
  PARTNER_PIPELINE_STAGES,
  PREFERRED_CONTACT_METHODS,
  PipelineStage,
} from "@/lib/database.types";

const PIPELINE_STAGES: PipelineStage[] = ["Marketing", "Processing", "In Contract", "Other"];

type PartnerOption = { id: string; name: string; partner_category: string | null };

export default function NewContactForm({
  userId,
  defaultType,
}: {
  userId: string;
  defaultType: ContactType;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  // ─── Quick fields ────────────────────────────────────────
  const [contactType, setContactType] = useState<ContactType>(defaultType);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quickNote, setQuickNote] = useState("");

  // ─── More details ────────────────────────────────────────
  // Default: collapsed on mobile (<768px), expanded on desktop (≥768px)
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setShowMore(true);
    }
  }, []);

  // Common
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [birthday, setBirthday] = useState("");
  const [preferredContact, setPreferredContact] = useState<PreferredContactMethod | "">("");

  // Client-specific
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("Marketing");
  const [campaign, setCampaign] = useState("");
  const [referredByPartnerId, setReferredByPartnerId] = useState<string>("");

  // Partner-specific
  const [firm, setFirm] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [partnerCategory, setPartnerCategory] = useState<PartnerCategory | "">("");
  const [nicheFitNotes, setNicheFitNotes] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [activeSince, setActiveSince] = useState("");
  const [partnerStage, setPartnerStage] = useState<PartnerPipelineStage>("Prospecting");

  // ─── Load partners for "Referred By" dropdown (Client only) ──
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  useEffect(() => {
    if (contactType !== "Client") return;
    if (partners.length > 0) return; // load once
    supabase
      .from("contacts")
      .select("id, name, partner_category")
      .eq("user_id", userId)
      .eq("contact_type", "Partner")
      .order("name")
      .then(({ data }) => {
        if (data) setPartners(data as PartnerOption[]);
      });
  }, [contactType, partners.length, supabase, userId]);

  // ─── Submit ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error("Add at least a phone or email");
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const insertData: any = {
      user_id: userId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      contact_type: contactType,
      notes: quickNote.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      birthday: birthday || null,
      preferred_contact_method: preferredContact || null,
      created_at: now,
      updated_at: now,
      ml_update_needed: false,
      response_received: false,
    };

    if (contactType === "Client" || contactType === "Lead") {
      insertData.pipeline_stage = pipelineStage;
      insertData.campaign = campaign.trim() || null;
      insertData.referred_by_partner_id = referredByPartnerId || null;
    } else {
      // For Partners, pipeline_stage defaults to "Other" since it isn't applicable
      insertData.pipeline_stage = "Other";
    }

    if (contactType === "Partner") {
      insertData.firm = firm.trim() || null;
      insertData.role_title = roleTitle.trim() || null;
      insertData.partner_category = partnerCategory || null;
      insertData.niche_fit_notes = nicheFitNotes.trim() || null;
      insertData.linkedin_url = linkedinUrl.trim() || null;
      insertData.active_since = activeSince || null;
      insertData.partner_pipeline_stage = partnerStage;
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(insertData)
      .select()
      .single();

    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Failed to save contact");
      return;
    }
    toast.success(`${contactType} added!`);
    if (data) router.push(`/contacts/${(data as any).id}`);
  };

  const typeButtonClass = (t: ContactType) =>
    `flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
      contactType === t
        ? "bg-navy-900 text-white"
        : "bg-white text-navy-500 border border-navy-200"
    }`;

  return (
    <div className="h-full overflow-y-auto scroll-touch">
      {/* Header */}
      <div className="safe-top" style={{ background: "linear-gradient(135deg, #13144a, #1e1f6b)" }}>
        <div className="px-4 pt-2 pb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-white/60 text-sm mb-3 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="font-display font-bold text-white text-xl">Add Contact</h1>
          <p className="text-white/60 text-xs mt-1">Quick add — fill in more later if needed</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* ─── QUICK FIELDS ─────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          {/* Contact type tabs */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-2">Contact Type</label>
            <div className="flex gap-2">
              <button onClick={() => setContactType("Client")} className={typeButtonClass("Client")}>
                Client
              </button>
              <button onClick={() => setContactType("Partner")} className={typeButtonClass("Partner")}>
                Partner
              </button>
              <button onClick={() => setContactType("Lead")} className={typeButtonClass("Lead")}>
                Lead
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1">
              Name <span className="text-coral-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="input text-sm py-2"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="input text-sm py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="input text-sm py-2"
              />
            </div>
          </div>
          <p className="text-[11px] text-navy-400">At least a phone or email is required.</p>

          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1">
              Quick Note
            </label>
            <textarea
              value={quickNote}
              onChange={e => setQuickNote(e.target.value)}
              placeholder={
                contactType === "Partner"
                  ? "e.g. Met at Long Beach Bar mixer. Handles divorces with high-net-worth women."
                  : "e.g. Referred by Sarah. Looking for first home in Belmont Shore."
              }
              rows={3}
              className="input text-sm resize-none"
            />
          </div>
        </div>

        {/* ─── MORE DETAILS (collapsible) ──────────────────── */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-navy-50 transition-colors"
          >
            <span className="font-display font-semibold text-navy-800 text-sm">More Details</span>
            <span className="text-navy-400 text-xs">{showMore ? "Hide ▲" : "Expand ▼"}</span>
          </button>

          {showMore && (
            <div className="px-4 pb-4 space-y-3 border-t border-navy-100 pt-3">
              {/* ── Address group ── */}
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street address"
                  className="input text-sm py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="City"
                  className="input text-sm py-2"
                />
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="State"
                  className="input text-sm py-2"
                />
                <input
                  type="text"
                  value={zip}
                  onChange={e => setZip(e.target.value)}
                  placeholder="Zip"
                  className="input text-sm py-2"
                />
              </div>

              {/* ── Common: birthday + preferred contact ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Birthday</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={e => setBirthday(e.target.value)}
                    className="input text-sm py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1">Preferred Contact</label>
                  <select
                    value={preferredContact}
                    onChange={e => setPreferredContact(e.target.value as PreferredContactMethod | "")}
                    className="input text-sm py-2"
                  >
                    <option value="">—</option>
                    {PREFERRED_CONTACT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ─── PARTNER-SPECIFIC FIELDS ─── */}
              {contactType === "Partner" && (
                <div className="space-y-3 pt-3 border-t border-navy-100">
                  <p className="section-title">Partner Details</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">Firm / Company</label>
                      <input
                        type="text"
                        value={firm}
                        onChange={e => setFirm(e.target.value)}
                        placeholder="e.g. Smith & Associates"
                        className="input text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">Role / Title</label>
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={e => setRoleTitle(e.target.value)}
                        placeholder="e.g. Partner"
                        className="input text-sm py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Partner Category</label>
                    <select
                      value={partnerCategory}
                      onChange={e => setPartnerCategory(e.target.value as PartnerCategory | "")}
                      className="input text-sm py-2"
                    >
                      <option value="">—</option>
                      {PARTNER_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Niche Fit Notes</label>
                    <textarea
                      value={nicheFitNotes}
                      onChange={e => setNicheFitNotes(e.target.value)}
                      placeholder="Why they fit your niche (1–2 sentences)"
                      rows={2}
                      className="input text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">LinkedIn URL</label>
                      <input
                        type="url"
                        value={linkedinUrl}
                        onChange={e => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="input text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">Active Since</label>
                      <input
                        type="date"
                        value={activeSince}
                        onChange={e => setActiveSince(e.target.value)}
                        className="input text-sm py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">Partner Stage</label>
                    <select
                      value={partnerStage}
                      onChange={e => setPartnerStage(e.target.value as PartnerPipelineStage)}
                      className="input text-sm py-2"
                    >
                      {PARTNER_PIPELINE_STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ─── CLIENT / LEAD–SPECIFIC FIELDS ─── */}
              {(contactType === "Client" || contactType === "Lead") && (
                <div className="space-y-3 pt-3 border-t border-navy-100">
                  <p className="section-title">{contactType} Details</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">Pipeline Stage</label>
                      <select
                        value={pipelineStage}
                        onChange={e => setPipelineStage(e.target.value as PipelineStage)}
                        className="input text-sm py-2"
                      >
                        {PIPELINE_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1">Campaign</label>
                      <input
                        type="text"
                        value={campaign}
                        onChange={e => setCampaign(e.target.value)}
                        placeholder="Optional"
                        className="input text-sm py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1">
                      Referred By <span className="text-navy-300 text-[10px]">(optional)</span>
                    </label>
                    <select
                      value={referredByPartnerId}
                      onChange={e => setReferredByPartnerId(e.target.value)}
                      className="input text-sm py-2"
                    >
                      <option value="">— Not referred by a partner</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.partner_category ? ` · ${p.partner_category}` : ""}
                        </option>
                      ))}
                    </select>
                    {partners.length === 0 && (
                      <p className="text-[11px] text-navy-400 mt-1">
                        No partners added yet. Add a partner first to assign attribution.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Save buttons ──────────────────────────────── */}
        <div className="flex gap-2 pb-4">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save ${contactType}`}
          </button>
        </div>
      </div>
    </div>
  );
}
