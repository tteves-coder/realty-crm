export type PipelineStage = "Marketing" | "Processing" | "In Contract" | "Other";
export type TaskStatus = "pending" | "completed";
export type PriorityScore = "HIGH" | "MED" | "LOW" | null;
export type TouchType = "call" | "text" | "email" | "met" | "sent_content" | "postcard" | "bombbomb" | "other";

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
  // Pipeline
  pipeline_stage: PipelineStage;
  campaign: string | null;
  status: string | null;
  // Priority & scoring
  priority_score: PriorityScore;
  priority_order: number | null;
  // Property data
  credit_score: string | null;
  equity_flag: boolean | null;
  mortgage_amount: string | null;
  year_purchased: string | null;
  // Tracking
  notes: string | null;
  next_steps: string | null;
  last_contacted: string | null;
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
