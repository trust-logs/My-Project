-- ERRANDGO PRODUCTION AUTH REPAIR
-- Run after 002/003/005. Safe to re-run.
-- Repairs auth/profile synchronization for existing and new users.

create extension if not exists pgcrypto;

-- Ensure the profile columns used by the auth triggers exist.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists country text default 'Nigeria';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists rating numeric(3,2) default 5.0;
alter table public.profiles add column if not exists completed_errands integer default 0;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Ensure every user gets a wallet without depending on the client.
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'NGN',
  balance numeric(18,2) not null default 0,
  pending_balance numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, username, email, phone, country
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'username',''),
    new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    coalesce(nullif(new.raw_user_meta_data->>'country',''),'Nigeria')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
    phone = coalesce(excluded.phone, public.profiles.phone),
    country = coalesce(excluded.country, public.profiles.country),
    updated_at = now();

  insert into public.wallets(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profile phone/country synchronized when auth metadata changes.
create or replace function public.sync_auth_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      phone = coalesce(nullif(new.raw_user_meta_data->>'phone',''), phone),
      country = coalesce(nullif(new.raw_user_meta_data->>'country',''), country),
      full_name = case
        when coalesce(new.raw_user_meta_data->>'full_name','') <> ''
        then new.raw_user_meta_data->>'full_name'
        else full_name
      end,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_profile on auth.users;
create trigger on_auth_user_phone_profile
after update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_profile_phone();

-- Backfill any auth users whose profile/wallet was missed by an earlier trigger.
do $$
declare u record;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    insert into public.profiles (id, full_name, username, email, phone, country)
    values (
      u.id,
      coalesce(u.raw_user_meta_data->>'full_name',''),
      nullif(u.raw_user_meta_data->>'username',''),
      u.email,
      nullif(u.raw_user_meta_data->>'phone',''),
      coalesce(nullif(u.raw_user_meta_data->>'country',''),'Nigeria')
    )
    on conflict (id) do update set
      email = excluded.email,
      phone = coalesce(excluded.phone, public.profiles.phone),
      country = coalesce(excluded.country, public.profiles.country),
      updated_at = now();

    insert into public.wallets(user_id) values (u.id)
    on conflict (user_id) do nothing;
  end loop;
end $$;

-- RLS remains enforced; authenticated users may only update their own profile.
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_authenticated') then
    create policy profiles_select_authenticated on public.profiles
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_authenticated_own') then
    create policy profiles_update_authenticated_own on public.profiles
      for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets_select_authenticated_own') then
    create policy wallets_select_authenticated_own on public.wallets
      for select to authenticated using (user_id=auth.uid());
  end if;
end $$;
