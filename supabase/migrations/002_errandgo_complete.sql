-- ERRANDGO COMPLETE DATABASE SETUP
-- Run this ONE file in Supabase SQL Editor.
-- Safe to re-run on a fresh or partially-created ErrandGo database.

create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, username text unique, email text, phone text, avatar_url text, country text default 'Nigeria', city text, bio text, role text default 'user', rating numeric(3,2) not null default 5.0, completed_errands integer not null default 0, is_verified boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.wallets (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade, currency text not null default 'NGN', balance numeric(18,2) not null default 0, pending_balance numeric(18,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, icon text, created_at timestamptz not null default now());
create table if not exists public.errands (id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id) on delete cascade, runner_id uuid references public.profiles(id) on delete set null, category_id uuid references public.categories(id) on delete set null, title text not null, description text not null, category text not null default 'Other', budget numeric(18,2) not null check (budget >= 0), currency text not null default 'NGN', status text not null default 'open' check (status in ('open','pending','accepted','in_progress','completed','cancelled','disputed')), pickup_address text, delivery_address text, pickup_latitude double precision, pickup_longitude double precision, delivery_latitude double precision, delivery_longitude double precision, latitude numeric(10,7), longitude numeric(10,7), scheduled_at timestamptz, distance_km numeric(10,2), accepted_at timestamptz, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.applications (id uuid primary key default gen_random_uuid(), errand_id uuid not null references public.errands(id) on delete cascade, runner_id uuid not null references public.profiles(id) on delete cascade, message text, proposed_price numeric(18,2), status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')), created_at timestamptz not null default now(), unique(errand_id, runner_id));
create table if not exists public.conversations (id uuid primary key default gen_random_uuid(), errand_id uuid references public.errands(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.conversation_members (conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, joined_at timestamptz not null default now(), primary key (conversation_id, user_id));
create table if not exists public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade, message text not null, attachment_url text, created_at timestamptz not null default now(), read_at timestamptz);
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, title text not null, body text not null, type text default 'system', data jsonb not null default '{}'::jsonb, read boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, errand_id uuid references public.errands(id) on delete set null, type text not null, amount numeric(18,2) not null, currency text not null default 'NGN', reference text unique, status text not null default 'pending', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.reviews (id uuid primary key default gen_random_uuid(), errand_id uuid not null references public.errands(id) on delete cascade, reviewer_id uuid not null references public.profiles(id) on delete cascade, reviewee_id uuid not null references public.profiles(id) on delete cascade, rating integer not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now(), unique(errand_id, reviewer_id));
create table if not exists public.saved_errands (user_id uuid not null references public.profiles(id) on delete cascade, errand_id uuid not null references public.errands(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id, errand_id));
create table if not exists public.disputes (id uuid primary key default gen_random_uuid(), errand_id uuid references public.errands(id) on delete cascade, opened_by uuid references public.profiles(id) on delete cascade, reason text, description text, status text not null default 'open', resolution text, created_at timestamptz not null default now(), resolved_at timestamptz);
create table if not exists public.support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, subject text not null, message text not null, status text not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.withdrawals (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, amount numeric(18,2) not null check (amount > 0), currency text not null default 'NGN', bank_name text, account_name text, account_number text, provider_reference text, status text not null default 'pending', created_at timestamptz not null default now(), processed_at timestamptz);

-- Reconcile legacy/partially-created tables. CREATE TABLE IF NOT EXISTS does not modify an old table, so every column referenced below is explicitly ensured.
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists country text default 'Nigeria';
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists rating numeric(3,2) default 5.0;
alter table public.profiles add column if not exists completed_errands integer default 0;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.wallets add column if not exists currency text default 'NGN';
alter table public.wallets add column if not exists balance numeric(18,2) default 0;
alter table public.wallets add column if not exists pending_balance numeric(18,2) default 0;
alter table public.wallets add column if not exists updated_at timestamptz default now();
alter table public.errands add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.errands add column if not exists pickup_address text;
alter table public.errands add column if not exists delivery_address text;
alter table public.errands add column if not exists pickup_latitude double precision;
alter table public.errands add column if not exists pickup_longitude double precision;
alter table public.errands add column if not exists delivery_latitude double precision;
alter table public.errands add column if not exists delivery_longitude double precision;
alter table public.errands add column if not exists latitude numeric(10,7);
alter table public.errands add column if not exists longitude numeric(10,7);
alter table public.errands add column if not exists distance_km numeric(10,2);
alter table public.errands add column if not exists accepted_at timestamptz;
alter table public.errands add column if not exists started_at timestamptz;
alter table public.errands add column if not exists completed_at timestamptz;
alter table public.errands add column if not exists updated_at timestamptz default now();
alter table public.applications add column if not exists message text;
alter table public.applications add column if not exists proposed_price numeric(18,2);
alter table public.applications add column if not exists status text default 'pending';
alter table public.conversations add column if not exists errand_id uuid references public.errands(id) on delete cascade;
alter table public.conversations add column if not exists updated_at timestamptz default now();
alter table public.conversation_members add column if not exists joined_at timestamptz default now();
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists read_at timestamptz;
-- CRITICAL: older disputes tables may have neither errand_id nor opened_by.
alter table public.disputes add column if not exists errand_id uuid references public.errands(id) on delete cascade;
alter table public.disputes add column if not exists opened_by uuid references public.profiles(id) on delete cascade;
alter table public.disputes add column if not exists reason text;
alter table public.disputes add column if not exists description text;
alter table public.disputes add column if not exists status text default 'open';
alter table public.disputes add column if not exists resolution text;
alter table public.disputes add column if not exists resolved_at timestamptz;
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists updated_at timestamptz default now();
alter table public.withdrawals add column if not exists provider_reference text;
alter table public.withdrawals add column if not exists processed_at timestamptz;

-- Migrate common legacy dispute column names when they exist.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='disputes' and column_name='user_id') then
    execute 'update public.disputes set opened_by = user_id where opened_by is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='disputes' and column_name='errand') then
    execute 'update public.disputes set errand_id = errand where errand_id is null';
  end if;
end $$;

insert into public.categories(name, icon) values ('Shopping','🛍️'),('Delivery','📦'),('Food','🍔'),('Documents','📄'),('Home','🏠'),('Transport','🚗'),('Other','✨') on conflict (name) do nothing;
create index if not exists errands_status_created_idx on public.errands(status, created_at desc);
create index if not exists errands_customer_idx on public.errands(customer_id);
create index if not exists errands_runner_idx on public.errands(runner_id);
create index if not exists applications_errand_idx on public.applications(errand_id);
create index if not exists applications_runner_idx on public.applications(runner_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists transactions_user_idx on public.transactions(user_id, created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, username, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'username',''), new.email) on conflict (id) do update set email=excluded.email;
  insert into public.wallets(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.errands enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.transactions enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_errands enable row level security;
alter table public.disputes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.withdrawals enable row level security;

-- Remove policies created by earlier attempts so this block can be safely re-run.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','wallets','categories','errands','applications','conversations','conversation_members','messages','notifications','transactions','reviews','saved_errands','disputes','support_tickets','withdrawals') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id=auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy wallets_own_read on public.wallets for select to authenticated using (user_id=auth.uid());
create policy categories_read on public.categories for select to authenticated using (true);
create policy errands_read on public.errands for select to authenticated using (status='open' or customer_id=auth.uid() or runner_id=auth.uid());
create policy errands_insert on public.errands for insert to authenticated with check (customer_id=auth.uid());
create policy errands_update on public.errands for update to authenticated using (customer_id=auth.uid() or runner_id=auth.uid()) with check (customer_id=auth.uid() or runner_id=auth.uid());
create policy errands_delete on public.errands for delete to authenticated using (customer_id=auth.uid());
create policy applications_read on public.applications for select to authenticated using (runner_id=auth.uid() or exists(select 1 from public.errands e where e.id=errand_id and e.customer_id=auth.uid()));
create policy applications_insert on public.applications for insert to authenticated with check (runner_id=auth.uid());
create policy applications_update on public.applications for update to authenticated using (runner_id=auth.uid() or exists(select 1 from public.errands e where e.id=errand_id and e.customer_id=auth.uid()));
create policy conversations_read on public.conversations for select to authenticated using (exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy conversation_members_read on public.conversation_members for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_members.conversation_id and cm.user_id=auth.uid()));
create policy messages_read on public.messages for select to authenticated using (exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy messages_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy notifications_own on public.notifications for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy transactions_own_read on public.transactions for select to authenticated using (user_id=auth.uid());
create policy reviews_read on public.reviews for select to authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated with check (reviewer_id=auth.uid());
create policy saved_own on public.saved_errands for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy disputes_read on public.disputes for select to authenticated using (opened_by=auth.uid() or exists(select 1 from public.errands e where e.id=errand_id and (e.customer_id=auth.uid() or e.runner_id=auth.uid())));
create policy disputes_insert on public.disputes for insert to authenticated with check (opened_by=auth.uid());
create policy support_own on public.support_tickets for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy withdrawals_own on public.withdrawals for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.set_errand_status(p_errand_id uuid, p_status text) returns public.errands language plpgsql security definer set search_path=public as $$
declare r public.errands;
begin
  if p_status not in ('in_progress','completed','cancelled','disputed') then raise exception 'Invalid status'; end if;
  update public.errands set status=p_status, started_at=case when p_status='in_progress' then coalesce(started_at,now()) else started_at end, completed_at=case when p_status='completed' then now() else completed_at end, updated_at=now() where id=p_errand_id and (customer_id=auth.uid() or runner_id=auth.uid()) returning * into r;
  if r.id is null then raise exception 'Errand not found or access denied'; end if;
  return r;
end;
$$;
grant execute on function public.set_errand_status(uuid,text) to authenticated;

-- Add realtime publication entries only when they are not already present.
do $$
begin
  if to_regclass('public.messages') is not null and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
  if to_regclass('public.notifications') is not null and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;
