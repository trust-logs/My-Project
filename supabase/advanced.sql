-- Additional production entities for withdrawals, identity checks, and support.
create table if not exists public.payout_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric(18,2) not null check(amount>0),
 currency char(3) not null default 'NGN',
 bank_code text,
 account_number text,
 account_name text,
 provider text,
 provider_reference text unique,
 status text not null default 'pending' check(status in ('pending','processing','successful','failed','cancelled')),
 failure_reason text,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);
create table if not exists public.verifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 provider text,
 provider_reference text,
 status text default 'pending' check(status in ('pending','verified','rejected')),
 document_type text,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete set null,
 subject text not null,
 message text not null,
 status text default 'open' check(status in ('open','in_progress','resolved','closed')),
 priority text default 'normal' check(priority in ('low','normal','high','urgent')),
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);
alter table public.payout_requests enable row level security;
alter table public.verifications enable row level security;
alter table public.support_tickets enable row level security;
create policy "own payout requests" on public.payout_requests for select using(auth.uid()=user_id);
create policy "own verification" on public.verifications for select using(auth.uid()=user_id);
create policy "own support tickets" on public.support_tickets for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
