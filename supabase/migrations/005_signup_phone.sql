-- ErrandGo: persist the international phone collected at signup.
-- Safe to run once; all statements are idempotent.

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists country text;

create or replace function public.sync_auth_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'country','')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case
      when coalesce(excluded.full_name,'') <> '' then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.profiles.phone),
    country = coalesce(excluded.country, public.profiles.country);

  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_profile on auth.users;

create trigger on_auth_user_phone_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_profile_phone();

grant execute on function public.sync_auth_profile_phone() to service_role;
