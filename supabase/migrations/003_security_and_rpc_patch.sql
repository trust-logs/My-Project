-- ERRANDGO SECURITY PATCH
-- 002_errandgo_complete.sql now contains the complete dependency-safe schema.
-- This file is intentionally idempotent and can be run after 002.

-- conversation_members is guaranteed by migration 002 before this policy is created.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='conversation_members' and policyname='conversation_members_own_read') then
    create policy conversation_members_own_read on public.conversation_members
      for select to authenticated
      using (user_id = auth.uid() or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversation_members.conversation_id
          and cm.user_id = auth.uid()
      ));
  end if;
end $$;

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
  set status=p_status,
      started_at=case when p_status='in_progress' then coalesce(started_at,now()) else started_at end,
      completed_at=case when p_status='completed' then now() else completed_at end,
      updated_at=now()
  where id=p_errand_id
    and (customer_id=auth.uid() or runner_id=auth.uid())
  returning * into r;
  if r.id is null then raise exception 'Errand not found or access denied'; end if;
  return r;
end;
$$;

grant execute on function public.set_errand_status(uuid,text) to authenticated;
