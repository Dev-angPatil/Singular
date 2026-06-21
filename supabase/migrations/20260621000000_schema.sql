-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================================
-- TABLE: profiles
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  target_paycheck numeric not null default 0 check (target_paycheck >= 0),
  reserve_floor numeric not null default 0 check (reserve_floor >= 0),
  tax_bracket numeric not null default 0.22 check (tax_bracket >= 0 and tax_bracket <= 1.00),
  ytd_income numeric not null default 0 check (ytd_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- TABLE: balances
-- =========================================================================
create table public.balances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  tax_pool numeric not null default 0 check (tax_pool >= 0),
  salary_buffer numeric not null default 0 check (salary_buffer >= 0),
  reserve_floor numeric not null default 0 check (reserve_floor >= 0),
  yield_pool numeric not null default 0 check (yield_pool >= 0),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- TABLE: transactions
-- =========================================================================
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('deposit', 'paycheck_payout', 'tax_allocation', 'yield_route', 'yield_recall', 'writeoff_release')),
  amount numeric not null check (amount >= 0),
  description text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- TABLE: invoices
-- =========================================================================
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client text not null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- TABLE: receipts
-- =========================================================================
create table public.receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  is_eligible_writeoff boolean not null default false,
  explanation text,
  image_url text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- TABLE: agent_logs
-- =========================================================================
create table public.agent_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent text not null check (agent in ('accountant', 'tax_advisor', 'treasury', 'invoice_sentinel')),
  message text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =========================================================================
create index if not exists transactions_user_id_created_at_idx on public.transactions(user_id, created_at desc);
create index if not exists invoices_user_id_due_date_idx on public.invoices(user_id, due_date desc);
create index if not exists receipts_user_id_created_at_idx on public.receipts(user_id, created_at desc);
create index if not exists agent_logs_user_id_created_at_idx on public.agent_logs(user_id, created_at desc);

-- =========================================================================
-- TRIGGER 1: handle_new_user (auth.users -> profiles)
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, target_paycheck, reserve_floor, tax_bracket, ytd_income)
  values (new.id, 0, 0, 0.22, 0);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- TRIGGER 2: handle_new_profile (profiles -> balances)
-- =========================================================================
create or replace function public.handle_new_profile()
returns trigger as $$
begin
  insert into public.balances (user_id, tax_pool, salary_buffer, reserve_floor, yield_pool)
  values (new.id, 0, 0, 0, 0);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- =========================================================================
-- TRIGGER 3: handle_updated_at (update timestamps)
-- =========================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger update_balances_updated_at
  before update on public.balances
  for each row execute procedure public.handle_updated_at();

create trigger update_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.handle_updated_at();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.balances enable row level security;
alter table public.transactions enable row level security;
alter table public.invoices enable row level security;
alter table public.receipts enable row level security;
alter table public.agent_logs enable row level security;

-- Policies for profiles
create policy "Users can select own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Policies for balances
create policy "Users can select own balances" on public.balances
  for select using (auth.uid() = user_id);

create policy "Users can insert own balances" on public.balances
  for insert with check (auth.uid() = user_id);

create policy "Users can update own balances" on public.balances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own balances" on public.balances
  for delete using (auth.uid() = user_id);

-- Policies for transactions
create policy "Users can select own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- Policies for invoices
create policy "Users can select own invoices" on public.invoices
  for select using (auth.uid() = user_id);

create policy "Users can insert own invoices" on public.invoices
  for insert with check (auth.uid() = user_id);

create policy "Users can update own invoices" on public.invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own invoices" on public.invoices
  for delete using (auth.uid() = user_id);

-- Policies for receipts
create policy "Users can select own receipts" on public.receipts
  for select using (auth.uid() = user_id);

create policy "Users can insert own receipts" on public.receipts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own receipts" on public.receipts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own receipts" on public.receipts
  for delete using (auth.uid() = user_id);

-- Policies for agent_logs
create policy "Users can select own agent_logs" on public.agent_logs
  for select using (auth.uid() = user_id);

create policy "Users can insert own agent_logs" on public.agent_logs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own agent_logs" on public.agent_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own agent_logs" on public.agent_logs
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- DEMO SEED DATA (April - June 2026)
-- =========================================================================

-- Seed User in auth.users (to test auth trigger integrations)
insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  encrypted_password
) values (
  'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0',
  'demo@singular.ai',
  '{"provider":"email","providers":["email"]}',
  '{"name":"Demo User"}',
  '2026-04-01T00:00:00Z',
  '2026-04-01T00:00:00Z',
  'authenticated',
  'authenticated',
  crypt('password123', gen_salt('bf'))
) on conflict (id) do nothing;

-- Update the auto-created profile to realistic onboarded settings
update public.profiles
set
  target_paycheck = 3500.00,
  reserve_floor = 5000.00,
  tax_bracket = 0.24,
  ytd_income = 71000.00,
  created_at = '2026-04-01T00:00:00Z',
  updated_at = '2026-06-19T09:00:00Z'
where id = 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0';

-- Update the auto-created balances to final state
update public.balances
set
  tax_pool = 17007.00,
  salary_buffer = 17500.00,
  reserve_floor = 5000.00,
  yield_pool = 20493.00,
  updated_at = '2026-06-19T09:00:00Z'
where user_id = 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0';

-- Seed Invoices
insert into public.invoices (id, user_id, client, amount, status, due_date, created_at, updated_at) values
  ('i0000001-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'Acme Corp', 8000.00, 'paid', '2026-04-10', '2026-03-25T10:00:00Z', '2026-04-03T10:05:00Z'),
  ('i0000002-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'Wayne Enterprises', 15000.00, 'paid', '2026-05-15', '2026-04-20T10:00:00Z', '2026-05-02T11:05:00Z'),
  ('i0000003-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'Stark Industries', 18000.00, 'paid', '2026-06-01', '2026-05-10T10:00:00Z', '2026-05-25T15:05:00Z'),
  ('i0000004-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'Stark Industries', 30000.00, 'paid', '2026-06-15', '2026-05-28T10:00:00Z', '2026-06-12T10:35:00Z'),
  ('i0000005-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'LexCorp', 4500.00, 'overdue', '2026-06-01', '2026-05-15T10:00:00Z', '2026-05-15T10:00:00Z');

-- Seed Receipts
insert into public.receipts (id, user_id, amount, category, is_eligible_writeoff, explanation, image_url, created_at) values
  ('r0000001-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 150.00, 'Office Equipment', true, 'Ergonomic office chair for home workspace', 'https://supabase.co/storage/receipt_123.jpg', '2026-04-15T14:30:00Z'),
  ('r0000002-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'd0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 45.00, 'Meals', false, 'Client lunch at Starbucks (non-deductible/no receipt)', null, '2026-05-10T12:00:00Z');

-- Seed Transactions
insert into public.transactions (user_id, type, amount, description, created_at) values
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'deposit', 10000.00, 'Onboarding capital allocation', '2026-04-01T00:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'deposit', 8000.00, 'Acme Corp Invoice #101', '2026-04-03T10:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_allocation', 1760.00, 'Tax reservation for Acme Corp Invoice #101', '2026-04-03T10:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-04-10T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'writeoff_release', 33.00, 'Tax release from writeoff: Ergonomic office chair', '2026-04-15T14:35:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-04-24T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'deposit', 15000.00, 'Wayne Enterprises Invoice #102', '2026-05-02T11:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_allocation', 3300.00, 'Tax reservation for Wayne Enterprises Invoice #102', '2026-05-02T11:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-05-08T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-05-22T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'deposit', 18000.00, 'Stark Industries Invoice #103', '2026-05-25T15:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_allocation', 3960.00, 'Tax reservation for Stark Industries Invoice #103', '2026-05-25T15:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'yield_route', 2013.00, 'Excess cash routed to Ondo USDY', '2026-05-25T15:02:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-06-05T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'deposit', 30000.00, 'Stark Industries Milestone #2', '2026-06-12T10:30:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_allocation', 8020.00, 'Tax reservation (24% + retroactive adjustment for tax bracket shift)', '2026-06-12T10:31:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'yield_route', 18480.00, 'Excess cash routed to Ondo USDY', '2026-06-12T10:32:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'paycheck_payout', 3500.00, 'Bi-weekly payroll', '2026-06-19T09:00:00Z');

-- Seed Agent Logs
insert into public.agent_logs (user_id, agent, message, created_at) values
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent initialized. Salary buffer floor set to $5,000, target paycheck set to $3,500.', '2026-04-01T00:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Detected incoming deposit of $8,000.00 from Acme Corp Invoice #101.', '2026-04-03T10:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_advisor', 'Tax Advisor Agent computed 22% tax allocation ($1,760.00) from Acme Corp deposit.', '2026-04-03T10:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'OmniFlow routing: Allocated $1,760.00 to Tax Pool, $6,240.00 to Salary Buffer.', '2026-04-03T10:02:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-04-10T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'accountant', 'Accountant Agent audited receipt: $150.00 for Ergonomic office chair. Approved as eligible business write-off.', '2026-04-15T14:30:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_advisor', 'Released $33.00 (22% of $150.00) from Tax Pool back to Salary Buffer.', '2026-04-15T14:35:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-04-24T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Detected incoming deposit of $15,000.00 from Wayne Enterprises Invoice #102.', '2026-05-02T11:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_advisor', 'Tax Advisor Agent computed 22% tax allocation ($3,300.00) from Wayne Enterprises deposit.', '2026-05-02T11:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'OmniFlow routing: Allocated $3,300.00 to Tax Pool, $11,700.00 to Salary Buffer.', '2026-05-02T11:02:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-05-08T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-05-22T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Detected incoming deposit of $18,000.00 from Stark Industries Invoice #103.', '2026-05-25T15:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_advisor', 'Tax Advisor Agent computed 22% tax allocation ($3,960.00) from Stark Industries deposit.', '2026-05-25T15:01:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'OmniFlow routing: Allocated $3,960.00 to Tax Pool, $12,027.00 to Salary Buffer (filled to cap), and routed remaining $2,013.00 to Ondo USDY Yield Pool.', '2026-05-25T15:02:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-06-05T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'tax_advisor', 'Tax Advisor Agent detected YTD income ($71,000.00) crossed threshold. Tax bracket increased from 22% to 24%. Calculated retroactive shortfall of $820.00.', '2026-06-12T10:29:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Detected incoming deposit of $30,000.00 from Stark Industries Milestone #2.', '2026-06-12T10:30:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'OmniFlow routing: Allocated $8,020.00 to Tax Pool (24% of $30k + $820.00 adjustment), $3,500.00 to Salary Buffer (filled to cap), and routed remaining $18,480.00 to Ondo USDY Yield Pool.', '2026-06-12T10:32:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'treasury', 'Treasury Agent dispatched bi-weekly salary of $3,500.00 to personal spending account.', '2026-06-19T09:00:00Z'),
  ('d0e0a0b0-c0d0-e0f0-a0b0-c0d0e0f0a0b0', 'invoice_sentinel', 'Invoice Sentinel scanned LexCorp Invoice #104. Overdue by 19 days. Drafted urgent follow-up reminder email.', '2026-06-20T18:00:00Z');
