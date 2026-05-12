export type PipelineStage = "Marketing" | "Processing" | "In Contract" | "Other";
export type TaskStatus = "pending" | "completed";
export type PriorityScore = "HIGH" | "MED" | "LOW" | null;
export type TouchType = "call" | "text" | "email" | "met" | "sent_content" | "postcard" | "bombbomb" | "other";

// Week 2 additions
export type ContactType = "Client" | "Partner" | "Lead";

export type PartnerCategory =
  | "Family Law Attorney"
  | "CDFA"
  | "Financial Planner"
  | "Estate Attorney"
  | "CPA / Tax Professional"
  | "Title Rep"
  | "Real Estate Agent"
  | "Insurance Agent"
  | "Property Manager"
  | "1031 Intermediary"
  | "Therapist / Divorce Coach"
  | "HR / Employer Benefits"
  | "Other";

export type PartnerPipelineStage = "Prospecting" | "Outreach" | "Active" | "Dormant";

export type PreferredContactMethod = "Phone" | "Text" | "Email" | "LinkedIn";

export const PARTNER_CATEGORIES: PartnerCategory[] = [
  "Family Law Attorney",
  "CDFA",
  "Financial Planner",
  "Estate Attorney",
  "CPA / Tax Professional",
  "Title Rep",
  "Real Estate Agent",
  "Insurance Agent",
  "Property Manager",
  "1031 Intermediary",
  "Therapist / Divorce Coach",
  "HR / Employer Benefits",
  "Other",
];

export const PARTNER_PIPELINE_STAGES: PartnerPipelineStage[] = [
  "Prospecting", "Outreach", "Active", "Dormant",
];

export const PREFERRED_CONTACT_METHODS: PreferredContactMethod[] = [
  "Phone", "Text", "Email", "LinkedIn",
];

export interface Contact {
  id: string;
  user_id: string;
  // Basic info
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Contact type & pipeline
  contact_type: ContactType;
  pipeline_stage: PipelineStage;
  campaign: string | null;
  status: string | null;
  // Priority & scoring
  priority_score: PriorityScore;
  priority_order: number | null;
  // Property data (Client-side)
  credit_score: string | null;
  equity_flag: boolean | null;
  mortgage_amount: string | null;
  year_purchased: string | null;
  // Partner-specific fields
  firm: string | null;
  role_title: string | null;
  partner_category: PartnerCategory | null;
  niche_fit_notes: string | null;
  linkedin_url: string | null;
  active_since: string | null;
  partner_pipeline_stage: PartnerPipelineStage | null;
  // Common additions
  birthday: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  // Referral attribution
  referred_by_partner_id: string | null;
  // Tracking
  notes: string | null;
  next_steps: string | null;
  last_contacted: string | null;
  last_ml_export_at: string | null;
  ml_update_needed: boolean;
  response_received: boolean;
  response_date: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface TouchLog {
  id: string;
  contact_id: string;
  user_id: string;
  touch_type: TouchType;
  notes: string | null;
  touched_at: string;
}

export interface Task {
  id: string;
  contact_id: string;
  user_id: string;
  description: string;
  due_date: string;
  status: TaskStatus;
  created_at: string;
}

export interface DailyActivity {
  id?: string;
  user_id: string;
  date: string;
  calls: number;
  texts: number;
  met: number;
  sent_content: number;
  realtors: number;
  networking: number;
  conversations: number;
  appts_set: number;
  appts_conducted: number;
  clients: number;
  leads: number;
  closings: number;
}

