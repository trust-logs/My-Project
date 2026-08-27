-- Safe follow-up migration for ErrandGo marketplace.
-- Run after 002_errandgo_complete.sql in Supabase SQL Editor.

drop policy if exists conversation_members_own_read on public.conversation_members;
create policy conversation_members_own_read on public.conversation_members
  for select using (user_id = auth.uid());

create or replace function public.set_errand_status(p_errand_id uuid, p_status text)
returns public.errands
language plpgsql
security definer
set search_path = public
as $$
declare r public.errands;
begin
  if p_status not in ('in_progress','completed','cancelled','disputed') then
    raise exception 'Invalid status';
  end if;
  update public.errands
    set status = p_status,
        started_at = case when p_status='in_progress' then coalesce(started_at, now()) else started_at end,
        completed_at = case when p_status='completed' then now() else completed_at end
  where id = p_errand_id
    and (customer_id = auth.uid() or runner_id = auth.uid())
  returning * into r;
  if r.id is null then raise exception 'Errand not found or access denied'; end if;
  return r;
end;
$$;

grant execute on function public.set_errand_status(uuid,text) to authenticated;
