-- ============================================================
-- APA Realty CRM v3 — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CONTACTS (core table with all fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Basic
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  -- Pipeline
  pipeline_stage TEXT NOT NULL DEFAULT 'Other'
    CHECK (pipeline_stage IN ('Marketing', 'Processing', 'In Contract', 'Other')),
  campaign TEXT,
  status TEXT,
  -- Priority
  priority_score TEXT CHECK (priority_score IN ('HIGH', 'MED', 'LOW')),
  priority_order INT,
  -- Property data
  credit_score TEXT,
  equity_flag BOOLEAN,
  mortgage_amount TEXT,
  year_purchased TEXT,
  -- Tracking
  notes TEXT,
  next_steps TEXT,
  last_contacted DATE,
  ml_update_needed BOOLEAN DEFAULT FALSE,
  response_received BOOLEAN DEFAULT FALSE,
  response_date DATE,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_user_stage_idx ON contacts(user_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS contacts_user_priority_idx ON contacts(user_id, priority_score);

-- ============================================================
-- TOUCH LOGS (per-contact activity history)
-- ============================================================
CREATE TABLE IF NOT EXISTS touch_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  touch_type TEXT NOT NULL CHECK (touch_type IN ('call','text','email','door','postcard','bombbomb','other')),
  notes TEXT,
  touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS touch_logs_contact_idx ON touch_logs(contact_id, touched_at DESC);
CREATE INDEX IF NOT EXISTS touch_logs_user_idx ON touch_logs(user_id, touched_at DESC);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_status_due_idx ON tasks(user_id, status, due_date);

-- ============================================================
-- DAILY ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls INT NOT NULL DEFAULT 0,
  texts INT NOT NULL DEFAULT 0,
  door_knocking INT NOT NULL DEFAULT 0,
  realtors INT NOT NULL DEFAULT 0,
  networking INT NOT NULL DEFAULT 0,
  conversations INT NOT NULL DEFAULT 0,
  appts_set INT NOT NULL DEFAULT 0,
  appts_conducted INT NOT NULL DEFAULT 0,
  clients INT NOT NULL DEFAULT 0,
  leads INT NOT NULL DEFAULT 0,
  closings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS activities_user_date_idx ON daily_activities(user_id, date);

-- ============================================================
-- AUTO UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER activities_updated_at BEFORE UPDATE ON daily_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE touch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_own" ON contacts;
DROP POLICY IF EXISTS "touch_logs_own" ON touch_logs;
DROP POLICY IF EXISTS "tasks_own" ON tasks;
DROP POLICY IF EXISTS "activities_own" ON daily_activities;

CREATE POLICY "contacts_own" ON contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "touch_logs_own" ON touch_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_own" ON tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activities_own" ON daily_activities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DONE — verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================
