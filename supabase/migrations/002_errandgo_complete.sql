-- ErrandGo complete marketplace schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  phone text,
  avatar_url text,
  country text default 'Nigeria',
  city text,
  bio text,
  role text default 'user' check (role in ('user','runner','admin')),
  rating numeric(3,2) default 5.0,
  completed_errands integer default 0,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.errands (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  runner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  category text not null default 'Other',
  budget numeric(14,2) not null check (budget >= 0),
  currency text not null default 'NGN',
  status text not null default 'open' check (status in ('open','pending','accepted','in_progress','completed','cancelled','disputed')),
  pickup_address text,
  delivery_address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  delivery_latitude numeric(10,7),
  delivery_longitude numeric(10,7),
  scheduled_at timestamptz,
  distance_km numeric(10,2),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  errand_id uuid not null references public.errands(id) on delete cascade,
  runner_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  proposed_price numeric(14,2),
  status text default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz default now(),
  unique(errand_id, runner_id)
);

create table if not exists public.saved_errands (
  user_id uuid references public.profiles(id) on delete cascade,
  errand_id uuid references public.errands(id) on delete cascade,
  created_at timestamptz default now(),
  primary key(user_id, errand_id)
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'NGN',
  balance numeric(14,2) not null default 0,
  pending_balance numeric(14,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  errand_id uuid references public.errands(id) on delete set null,
  type text not null check (type in ('deposit','withdrawal','escrow_hold','escrow_release','refund','fee','earning','adjustment')),
  amount numeric(14,2) not null,
  currency text not null default 'NGN',
  reference text unique,
  status text not null default 'pending' check (status in ('pending','successful','failed','reversed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  errand_id uuid references public.errands(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  attachment_url text,
  created_at timestamptz default now(),
  read_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text default 'system',
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  errand_id uuid not null references public.errands(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(errand_id, reviewer_id)
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  errand_id uuid not null references public.errands(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text default 'open' check(status in ('open','investigating','resolved','closed')),
  resolution text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  status text default 'open' check(status in ('open','pending','resolved','closed')),
  created_at timestamptz default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check(amount > 0),
  currency text default 'NGN',
  bank_name text,
  account_name text,
  account_number text,
  provider_reference text,
  status text default 'pending' check(status in ('pending','processing','successful','failed','reversed')),
  created_at timestamptz default now()
);

create index if not exists errands_status_created_idx on public.errands(status, created_at desc);
create index if not exists errands_customer_idx on public.errands(customer_id);
create index if not exists errands_runner_idx on public.errands(runner_id);
create index if not exists applications_errand_idx on public.applications(errand_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, username) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'username','')) on conflict (id) do nothing;
  insert into public.wallets(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.errands enable row level security;
alter table public.applications enable row level security;
alter table public.saved_errands enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.withdrawals enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy errands_public_read on public.errands for select using (status = 'open' or customer_id = auth.uid() or runner_id = auth.uid());
create policy errands_create_own on public.errands for insert with check (customer_id = auth.uid());
create policy errands_update_participants on public.errands for update using (customer_id = auth.uid() or runner_id = auth.uid()) with check (customer_id = auth.uid() or runner_id = auth.uid());
create policy errands_delete_own on public.errands for delete using (customer_id = auth.uid());

create policy applications_read_participants on public.applications for select using (runner_id = auth.uid() or exists(select 1 from public.errands e where e.id = errand_id and e.customer_id = auth.uid()));
create policy applications_create_runner on public.applications for insert with check (runner_id = auth.uid());
create policy applications_update_participants on public.applications for update using (runner_id = auth.uid() or exists(select 1 from public.errands e where e.id = errand_id and e.customer_id = auth.uid()));

create policy saved_own_all on public.saved_errands for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wallets_own_read on public.wallets for select using (user_id = auth.uid());
create policy transactions_own_read on public.transactions for select using (user_id = auth.uid());
create policy notifications_own_all on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_public_read on public.reviews for select using (true);
create policy reviews_own_insert on public.reviews for insert with check (reviewer_id = auth.uid());
create policy disputes_participant_read on public.disputes for select using (opened_by = auth.uid() or exists(select 1 from public.errands e where e.id = errand_id and (e.customer_id = auth.uid() or e.runner_id = auth.uid())));
create policy disputes_own_insert on public.disputes for insert with check (opened_by = auth.uid());
create policy support_own_all on public.support_tickets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy withdrawals_own_all on public.withdrawals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy conversations_member_read on public.conversations for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy conversation_members_own_read on public.conversation_members for select using (user_id=auth.uid() or exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy messages_member_read on public.messages for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy messages_member_insert on public.messages for insert with check (sender_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
