-- ErrandGo live location and delivery tracking
-- Safe to run after 002_errandgo_complete.sql.

create table if not exists public.runner_locations (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles(id) on delete cascade,
  errand_id uuid not null references public.errands(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  heading double precision,
  speed double precision,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);

create table if not exists public.errand_status_history (
  id uuid primary key default gen_random_uuid(),
  errand_id uuid not null references public.errands(id) on delete cascade,
  status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists runner_status text not null default 'OFFLINE';
alter table public.profiles add column if not exists last_latitude double precision;
alter table public.profiles add column if not exists last_longitude double precision;
alter table public.profiles add column if not exists last_location_at timestamptz;

alter table public.errands add column if not exists pickup_latitude double precision;
alter table public.errands add column if not exists pickup_longitude double precision;
alter table public.errands add column if not exists delivery_latitude double precision;
alter table public.errands add column if not exists delivery_longitude double precision;
alter table public.errands add column if not exists estimated_distance numeric(10,2);
alter table public.errands add column if not exists estimated_duration integer;
alter table public.errands add column if not exists started_at timestamptz;
alter table public.errands add column if not exists completed_at timestamptz;
alter table public.errands add column if not exists accepted_at timestamptz;
alter table public.errands add column if not exists updated_at timestamptz default now();

-- Replace the legacy status check so the full delivery lifecycle is valid.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.errands'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.errands drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.errands add constraint errands_status_check
check (status in (
  'open','requested','searching_for_runner','accepted','runner_assigned',
  'runner_going_to_pickup','arrived_at_pickup','in_progress',
  'going_to_destination','arrived_at_destination','completed',
  'cancelled','disputed'
));

create index if not exists runner_locations_errand_time_idx on public.runner_locations(errand_id, recorded_at desc);
create index if not exists runner_locations_runner_time_idx on public.runner_locations(runner_id, recorded_at desc);
create index if not exists runner_locations_coords_idx on public.runner_locations(latitude, longitude);
create index if not exists errand_status_history_errand_time_idx on public.errand_status_history(errand_id, created_at);
create index if not exists profiles_runner_status_idx on public.profiles(runner_status);

alter table public.runner_locations enable row level security;
alter table public.errand_status_history enable row level security;

drop policy if exists runner_locations_insert_own on public.runner_locations;
drop policy if exists runner_locations_select_authorized on public.runner_locations;
drop policy if exists status_history_select_authorized on public.errand_status_history;
drop policy if exists status_history_insert_own on public.errand_status_history;

create policy runner_locations_insert_own
on public.runner_locations for insert to authenticated
with check (
  runner_id=auth.uid()
  and exists (
    select 1 from public.errands e
    where e.id=errand_id and e.runner_id=auth.uid()
    and e.status not in ('completed','cancelled')
  )
);

create policy runner_locations_select_authorized
on public.runner_locations for select to authenticated
using (
  runner_id=auth.uid()
  or exists (
    select 1 from public.errands e
    where e.id=errand_id
      and (e.customer_id=auth.uid() or e.runner_id=auth.uid())
  )
  or exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'
  )
);

create policy status_history_select_authorized
on public.errand_status_history for select to authenticated
using (
  changed_by=auth.uid()
  or exists (
    select 1 from public.errands e
    where e.id=errand_id and (e.customer_id=auth.uid() or e.runner_id=auth.uid())
  )
  or exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'
  )
);

create policy status_history_insert_own
on public.errand_status_history for insert to authenticated
with check (changed_by=auth.uid());

create or replace function public.record_runner_location(
  p_errand_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null,
  p_speed double precision default null,
  p_accuracy double precision default null
) returns public.runner_locations
language plpgsql security definer set search_path=public
as $$
declare r public.runner_locations;
begin
  if p_latitude is null or p_longitude is null then raise exception 'Location is required'; end if;
  if not exists (
    select 1 from public.errands
    where id=p_errand_id and runner_id=auth.uid()
      and status in ('accepted','runner_assigned','runner_going_to_pickup','arrived_at_pickup','in_progress','going_to_destination','arrived_at_destination')
  ) then
    raise exception 'You are not the active runner for this errand';
  end if;

  insert into public.runner_locations(runner_id,errand_id,latitude,longitude,heading,speed,accuracy)
  values(auth.uid(),p_errand_id,p_latitude,p_longitude,p_heading,p_speed,p_accuracy)
  returning * into r;

  update public.profiles
  set last_latitude=p_latitude,last_longitude=p_longitude,last_location_at=now(),runner_status='BUSY',updated_at=now()
  where id=auth.uid();

  return r;
end;
$$;
grant execute on function public.record_runner_location(uuid,double precision,double precision,double precision,double precision,double precision) to authenticated;

create or replace function public.set_runner_status(p_status text)
returns public.profiles
language plpgsql security definer set search_path=public
as $$
declare r public.profiles;
begin
  if upper(p_status) not in ('OFFLINE','ONLINE','BUSY') then raise exception 'Invalid runner status'; end if;
  update public.profiles set runner_status=upper(p_status), updated_at=now()
  where id=auth.uid() returning * into r;
  if r.id is null then raise exception 'Profile not found'; end if;
  return r;
end;
$$;
grant execute on function public.set_runner_status(text) to authenticated;

create or replace function public.transition_errand_status(p_errand_id uuid,p_status text)
returns public.errands
language plpgsql security definer set search_path=public
as $$
declare r public.errands;
declare old_status text;
begin
  select status into old_status from public.errands where id=p_errand_id for update;
  if old_status is null then raise exception 'Errand not found'; end if;

  if not (
    (auth.uid()=(select customer_id from public.errands where id=p_errand_id) and p_status in ('cancelled','requested'))
    or
    (auth.uid()=(select runner_id from public.errands where id=p_errand_id) and p_status in ('runner_going_to_pickup','arrived_at_pickup','in_progress','going_to_destination','arrived_at_destination','completed','cancelled'))
    or
    (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  ) then
    raise exception 'Access denied';
  end if;

  if p_status='completed' and old_status not in ('going_to_destination','arrived_at_destination','in_progress') then
    raise exception 'Errand cannot be completed from its current status';
  end if;
  if p_status='in_progress' and old_status not in ('accepted','runner_assigned','arrived_at_pickup') then
    raise exception 'Errand must be accepted or at pickup before starting';
  end if;

  update public.errands
  set status=p_status,
      started_at=case when p_status in ('in_progress','going_to_destination') then coalesce(started_at,now()) else started_at end,
      completed_at=case when p_status='completed' then now() else completed_at end,
      updated_at=now()
  where id=p_errand_id
  returning * into r;

  insert into public.errand_status_history(errand_id,status,changed_by)
  values(p_errand_id,p_status,auth.uid());

  if p_status in ('completed','cancelled') then
    update public.profiles set runner_status='ONLINE',updated_at=now()
    where id=r.runner_id and id=auth.uid();
  end if;

  return r;
end;
$$;
grant execute on function public.transition_errand_status(uuid,text) to authenticated;

-- Nearby runners using a bounded Haversine calculation; no private location rows are exposed.
create or replace function public.find_nearby_runners(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 5
)
returns table(user_id uuid,distance_km double precision)
language sql security definer set search_path=public
as $
  select x.user_id,x.distance_km
  from (
    select p.id as user_id,
      6371 * acos(
        least(1,greatest(-1,
          cos(radians(p_latitude))*cos(radians(p.last_latitude))*
          cos(radians(p.last_longitude)-radians(p_longitude))+
          sin(radians(p_latitude))*sin(radians(p.last_latitude))
        ))
      ) as distance_km
    from public.profiles p
    where p.runner_status='ONLINE'
      and p.last_latitude is not null
      and p.last_longitude is not null
      and p.id<>auth.uid()
      and not exists (
        select 1 from public.errands e
        where e.runner_id=p.id
          and e.status not in ('completed','cancelled')
      )
  ) x
  where x.distance_km <= greatest(0.5,p_radius_km)
  order by x.distance_km;
$;
grant execute on function public.find_nearby_runners(double precision,double precision,double precision) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='runner_locations') then
    alter publication supabase_realtime add table public.runner_locations;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='errands') then
    alter publication supabase_realtime add table public.errands;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='errand_status_history') then
    alter publication supabase_realtime add table public.errand_status_history;
  end if;
end $$;
