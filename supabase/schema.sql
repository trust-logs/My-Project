-- ERRANDGO PRODUCTION DATABASE
create extension if not exists pgcrypto;
create extension if not exists postgis;

create type public.errand_status as enum ('open','pending','accepted','in_progress','completed','cancelled','disputed');
create type public.application_status as enum ('pending','accepted','rejected','withdrawn');
create type public.transaction_type as enum ('deposit','escrow_hold','escrow_release','earning','withdrawal','refund','fee','adjustment');
create type public.transaction_status as enum ('pending','successful','failed','reversed');

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 username text unique,
 email text,
 phone text,
 avatar_url text,
 country text default 'Nigeria',
 city text,
 bio text,
 role text default 'user' check (role in ('user','admin')),
 rating numeric(3,2) default 5.0,
 completed_errands integer default 0,
 is_verified boolean default false,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists public.errands (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id) on delete cascade,
 runner_id uuid references public.profiles(id),
 title text not null,
 description text not null,
 category text not null default 'Other',
 budget numeric(18,2) not null check (budget >= 0),
 currency char(3) not null default 'NGN',
 status public.errand_status not null default 'open',
 pickup_address text,
 delivery_address text,
 pickup_lat double precision,
 pickup_lng double precision,
 delivery_lat double precision,
 delivery_lng double precision,
 scheduled_at timestamptz,
 distance_km numeric(10,2),
 created_at timestamptz default now(),
 updated_at timestamptz default now(),
 completed_at timestamptz
);

create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(),
 errand_id uuid not null references public.errands(id) on delete cascade,
 runner_id uuid not null references public.profiles(id) on delete cascade,
 message text,
 proposed_price numeric(18,2),
 status public.application_status default 'pending',
 created_at timestamptz default now(),
 unique(errand_id, runner_id)
);

create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 errand_id uuid references public.errands(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 runner_id uuid references public.profiles(id),
 created_at timestamptz default now()
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

create table if not exists public.wallets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 currency char(3) not null default 'NGN',
 balance numeric(18,2) not null default 0,
 pending_balance numeric(18,2) not null default 0,
 updated_at timestamptz default now()
);

create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 errand_id uuid references public.errands(id),
 type public.transaction_type not null,
 amount numeric(18,2) not null,
 currency char(3) not null default 'NGN',
 reference text unique,
 provider text,
 status public.transaction_status not null default 'pending',
 metadata jsonb default '{}'::jsonb,
 created_at timestamptz default now()
);

create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 errand_id uuid not null references public.errands(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id),
 reviewee_id uuid not null references public.profiles(id),
 rating integer not null check (rating between 1 and 5),
 comment text,
 created_at timestamptz default now(),
 unique(errand_id, reviewer_id)
);

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 body text not null,
 type text default 'general',
 read boolean default false,
 data jsonb default '{}'::jsonb,
 created_at timestamptz default now()
);

create table if not exists public.disputes (
 id uuid primary key default gen_random_uuid(),
 errand_id uuid not null references public.errands(id) on delete cascade,
 opened_by uuid not null references public.profiles(id),
 reason text not null,
 evidence jsonb default '[]'::jsonb,
 status text default 'open' check (status in ('open','investigating','resolved','rejected')),
 resolution text,
 created_at timestamptz default now(),
 resolved_at timestamptz
);

create table if not exists public.saved_errands (
 user_id uuid references public.profiles(id) on delete cascade,
 errand_id uuid references public.errands(id) on delete cascade,
 created_at timestamptz default now(),
 primary key(user_id, errand_id)
);

create index if not exists errands_status_idx on public.errands(status, created_at desc);
create index if not exists errands_customer_idx on public.errands(customer_id);
create index if not exists errands_runner_idx on public.errands(runner_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id, full_name, username, email) values (
   new.id,
   coalesce(new.raw_user_meta_data->>'full_name','New User'),
   nullif(new.raw_user_meta_data->>'username',''),
   new.email
 ) on conflict (id) do nothing;
 insert into public.wallets(user_id) values(new.id) on conflict (user_id) do nothing;
 return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.errands enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.disputes enable row level security;
alter table public.saved_errands enable row level security;

create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles own update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "errands public read open" on public.errands for select using (status='open' or auth.uid()=customer_id or auth.uid()=runner_id);
create policy "errands own create" on public.errands for insert with check (auth.uid()=customer_id);
create policy "errands participants update" on public.errands for update using (auth.uid()=customer_id or auth.uid()=runner_id) with check (auth.uid()=customer_id or auth.uid()=runner_id);
create policy "applications participants read" on public.applications for select using (auth.uid()=runner_id or exists(select 1 from public.errands e where e.id=errand_id and e.customer_id=auth.uid()));
create policy "applications runner create" on public.applications for insert with check (auth.uid()=runner_id);
create policy "applications runner/customer update" on public.applications for update using (auth.uid()=runner_id or exists(select 1 from public.errands e where e.id=errand_id and e.customer_id=auth.uid()));
create policy "conversation participants" on public.conversations for all using (auth.uid()=customer_id or auth.uid()=runner_id) with check (auth.uid()=customer_id or auth.uid()=runner_id);
create policy "message participants" on public.messages for all using (exists(select 1 from public.conversations c where c.id=conversation_id and (c.customer_id=auth.uid() or c.runner_id=auth.uid()))) with check (sender_id=auth.uid());
create policy "own wallet read" on public.wallets for select using (auth.uid()=user_id);
create policy "own transactions read" on public.transactions for select using (auth.uid()=user_id);
create policy "reviews public read" on public.reviews for select using (true);
create policy "reviews own create" on public.reviews for insert with check (auth.uid()=reviewer_id);
create policy "own notifications" on public.notifications for select using (auth.uid()=user_id);
create policy "own notifications update" on public.notifications for update using (auth.uid()=user_id);
create policy "dispute participants" on public.disputes for select using (auth.uid()=opened_by or exists(select 1 from public.errands e where e.id=errand_id and (e.customer_id=auth.uid() or e.runner_id=auth.uid())));
create policy "dispute own create" on public.disputes for insert with check (auth.uid()=opened_by);
create policy "saved own" on public.saved_errands for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Enable realtime for chat, errands, notifications.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.errands;
alter publication supabase_realtime add table public.notifications;
