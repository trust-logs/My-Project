-- ERRANDGO: unique phone, first-signup welcome, secure errand editing
-- Run once in Supabase SQL Editor.

-- 1) Store a normalized phone number on profiles and enforce uniqueness.
alter table public.profiles add column if not exists phone text;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'), '');
$$;

-- Keep the existing values, but normalize new/updated values.
update public.profiles
set phone = public.normalize_phone(phone)
where phone is not null;

create unique index if not exists profiles_phone_unique_idx
on public.profiles(phone)
where phone is not null and phone <> '';

-- 2) Secure errand editing: only the owner can edit, and only while open/unassigned.
create or replace function public.edit_own_errand(
  p_errand_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_budget numeric,
  p_currency text,
  p_pickup_address text,
  p_delivery_address text,
  p_scheduled_at timestamptz
)
returns public.errands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_errand public.errands;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;

  select * into v_errand from public.errands where id=p_errand_id for update;
  if not found then raise exception 'Errand not found.'; end if;
  if v_errand.customer_id <> v_user then raise exception 'Only the errand owner can edit this errand.'; end if;
  if v_errand.status <> 'open' or v_errand.runner_id is not null then
    raise exception 'This errand can no longer be edited because it has already been accepted or started.';
  end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_description),'') is null or coalesce(p_budget,0) <= 0 then
    raise exception 'Title, description and a valid budget are required.';
  end if;

  update public.errands set
    title=trim(p_title), description=trim(p_description), category=trim(p_category),
    budget=p_budget, currency=coalesce(nullif(trim(p_currency),''),'NGN'),
    pickup_address=trim(p_pickup_address), delivery_address=trim(p_delivery_address),
    scheduled_at=p_scheduled_at
  where id=p_errand_id
  returning * into v_errand;

  return v_errand;
end;
$$;

grant execute on function public.edit_own_errand(uuid,text,text,text,numeric,text,text,text,timestamptz) to authenticated;

-- 3) First-signup welcome. The auth trigger creates the profile and a private welcome conversation.
create or replace function public.errandgo_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'there');

  insert into public.profiles(id,email,full_name,phone)
  values(new.id,new.email,v_name,public.normalize_phone(new.raw_user_meta_data->>'phone'))
  on conflict (id) do update
  set email=excluded.email,
      full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
      phone=coalesce(public.profiles.phone,excluded.phone);

  insert into public.notifications(user_id,title,body,type,data)
  values(
    new.id,
    'Welcome to ErrandGo 👋',
    'Your ErrandGo account is ready. Post an errand, help someone nearby, chat safely, and get things done.',
    'welcome',
    jsonb_build_object('first_signup',true)
  )
  on conflict do nothing;

  -- Create a private welcome thread when the chat tables are available.
  insert into public.conversations(errand_id)
  values(null)
  returning id into v_conversation;

  insert into public.conversation_members(conversation_id,user_id)
  values(v_conversation,new.id)
  on conflict do nothing;

  insert into public.messages(conversation_id,sender_id,message)
  values(
    v_conversation,
    new.id,
    'WELCOME TO ERRANDGO 👋\n\nYour account is ready. Here are a few things to remember:\n\n• Keep important communication inside ErrandGo.\n• Never share your password, PIN or OTP.\n• Confirm errand details before starting.\n• Use ErrandGo support if something goes wrong.\n\nWe are glad to have you here. Get things done. Anywhere.'
  );

  return new;
exception
  when undefined_table or undefined_column then
    -- Profile/welcome notification still succeeds if an older deployment has no chat tables yet.
    return new;
end;
$$;

drop trigger if exists trg_errandgo_new_user_welcome on auth.users;
create trigger trg_errandgo_new_user_welcome
after insert on auth.users
for each row execute function public.errandgo_new_user_welcome();

grant execute on function public.errandgo_new_user_welcome() to authenticated;
