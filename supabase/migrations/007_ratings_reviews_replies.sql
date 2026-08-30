-- ErrandGo production ratings + reviews + owner replies
-- Run once in Supabase SQL Editor after the existing ErrandGo schema.

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  replier_id uuid not null references public.profiles(id) on delete cascade,
  reply text not null check (length(trim(reply)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_reviewee_created_idx
  on public.reviews(reviewee_id, created_at desc);

create index if not exists review_replies_review_idx
  on public.review_replies(review_id);

alter table public.review_replies enable row level security;

drop policy if exists review_replies_read on public.review_replies;
drop policy if exists review_replies_insert on public.review_replies;
drop policy if exists review_replies_update on public.review_replies;
drop policy if exists review_replies_delete on public.review_replies;

create policy review_replies_read
  on public.review_replies
  for select to authenticated
  using (true);

create policy review_replies_insert
  on public.review_replies
  for insert to authenticated
  with check (
    replier_id = auth.uid()
    and exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and r.reviewee_id = auth.uid()
    )
  );

create policy review_replies_update
  on public.review_replies
  for update to authenticated
  using (replier_id = auth.uid())
  with check (replier_id = auth.uid());

create policy review_replies_delete
  on public.review_replies
  for delete to authenticated
  using (replier_id = auth.uid());

create or replace function public.refresh_profile_rating(p_reviewee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_average numeric(3,2);
begin
  select
    count(*)::integer,
    round(coalesce(avg(rating), 0)::numeric, 2)
  into v_count, v_average
  from public.reviews
  where reviewee_id = p_reviewee_id;

  update public.profiles
  set
    rating = case when v_count = 0 then 0 else v_average end,
    updated_at = now()
  where id = p_reviewee_id;
end;
$$;

create or replace function public.sync_profile_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_rating(old.reviewee_id);
    return old;
  end if;

  perform public.refresh_profile_rating(new.reviewee_id);

  if tg_op = 'UPDATE' and old.reviewee_id is distinct from new.reviewee_id then
    perform public.refresh_profile_rating(old.reviewee_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_sync_profile_rating on public.reviews;

create trigger reviews_sync_profile_rating
after insert or update or delete on public.reviews
for each row
execute function public.sync_profile_rating_from_review();

create or replace function public.submit_review(
  p_errand_id uuid,
  p_reviewee_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_errand public.errands%rowtype;
  v_review public.reviews;
  v_expected_reviewee uuid;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_user is null then
    raise exception 'You must be signed in to leave a review.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  select *
  into v_errand
  from public.errands
  where id = p_errand_id;

  if not found then
    raise exception 'Errand not found.';
  end if;

  if v_errand.status <> 'completed' then
    raise exception 'Reviews are available after an errand is completed.';
  end if;

  if v_errand.customer_id <> v_user
     and v_errand.runner_id <> v_user then
    raise exception 'You were not a participant in this errand.';
  end if;

  if v_errand.customer_id = v_user then
    v_expected_reviewee := v_errand.runner_id;
  else
    v_expected_reviewee := v_errand.customer_id;
  end if;

  if p_reviewee_id is null or p_reviewee_id <> v_expected_reviewee then
    raise exception 'You can only rate the other participant in this errand.';
  end if;

  if p_reviewee_id = v_user then
    raise exception 'You cannot rate yourself.';
  end if;

  if exists (
    select 1
    from public.reviews
    where errand_id = p_errand_id
      and reviewer_id = v_user
  ) then
    raise exception 'You have already reviewed this errand.';
  end if;

  insert into public.reviews (
    errand_id,
    reviewer_id,
    reviewee_id,
    rating,
    comment
  )
  values (
    p_errand_id,
    v_user,
    p_reviewee_id,
    p_rating,
    v_comment
  )
  returning * into v_review;

  return v_review;
end;
$$;

grant execute on function public.submit_review(uuid, uuid, integer, text)
to authenticated;

create or replace function public.reply_to_review(
  p_review_id uuid,
  p_reply text
)
returns public.review_replies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.review_replies;
  v_text text := trim(coalesce(p_reply, ''));
begin
  if v_user is null then
    raise exception 'You must be signed in to reply.';
  end if;

  if length(v_text) = 0 or length(v_text) > 1000 then
    raise exception 'Reply must be between 1 and 1000 characters.';
  end if;

  if not exists (
    select 1
    from public.reviews
    where id = p_review_id
      and reviewee_id = v_user
  ) then
    raise exception 'Only the person being reviewed can reply.';
  end if;

  insert into public.review_replies (
    review_id,
    replier_id,
    reply
  )
  values (
    p_review_id,
    v_user,
    v_text
  )
  on conflict (review_id)
  do update set
    reply = excluded.reply,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.reply_to_review(uuid, text)
to authenticated;

-- Recalculate all existing profile ratings from the actual review records.
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_profile_rating(r.id);
  end loop;
end;
$$;
