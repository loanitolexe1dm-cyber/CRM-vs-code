-- ==============================================================================
-- LOANITOL CRM - DATABASE SETUP SCRIPT FOR SUPABASE
-- Project URL: https://lnwqemrkdhtrqccfdkzg.supabase.co
-- SQL Editor: https://supabase.com/dashboard/project/lnwqemrkdhtrqccfdkzg/sql/new
-- ==============================================================================

-- 1. CREATE TABLES
CREATE TABLE IF NOT EXISTS public.enquiries (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reminders (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.escalations (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.loan_types (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CREATE PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_updated_at ON public.enquiries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_updated_at ON public.departments (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_updated_at ON public.reminders (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_updated_at ON public.escalations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_types_updated_at ON public.loan_types (updated_at DESC);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_types ENABLE ROW LEVEL SECURITY;

-- 4. APPLY RLS ACCESS POLICIES
DROP POLICY IF EXISTS "Allow all access to enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;
DROP POLICY IF EXISTS "Allow all access to users" ON public.users;
DROP POLICY IF EXISTS "Allow all access to departments" ON public.departments;
DROP POLICY IF EXISTS "Allow all access to reminders" ON public.reminders;
DROP POLICY IF EXISTS "Allow all access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow all access to escalations" ON public.escalations;
DROP POLICY IF EXISTS "Allow all access to loan_types" ON public.loan_types;

CREATE POLICY "Allow all access to enquiries" ON public.enquiries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to departments" ON public.departments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to reminders" ON public.reminders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to escalations" ON public.escalations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to loan_types" ON public.loan_types FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. ENABLE SUPABASE REALTIME (Pure DDL - No Loops)
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_types;

-- 6. SUPABASE AUTH USER AUTO-CONFIRMATION (Immediate Login)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
