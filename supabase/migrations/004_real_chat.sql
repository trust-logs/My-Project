-- ERRANDGO REAL CHAT
-- Creates a conversation for an errand after an application and enables secure realtime messaging.

create or replace function public.ensure_errand_conversation(p_errand_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_runner uuid;
  v_conversation uuid;
begin
  select customer_id, runner_id into v_customer, v_runner
  from public.errands
  where id = p_errand_id;

  if v_customer is null then
    raise exception 'Errand not found';
  end if;

  if v_runner is null then
    select runner_id into v_runner
    from public.applications
    where errand_id = p_errand_id and runner_id = auth.uid()
    order by created_at desc limit 1;
  end if;

  if v_runner is null then
    raise exception 'No runner is associated with this errand';
  end if;

  if auth.uid() <> v_customer and auth.uid() <> v_runner then
    raise exception 'Access denied';
  end if;

  select id into v_conversation
  from public.conversations
  where errand_id = p_errand_id
  order by created_at asc
  limit 1;

  if v_conversation is null then
    insert into public.conversations(errand_id)
    values (p_errand_id)
    returning id into v_conversation;
  end if;

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation, v_customer), (v_conversation, v_runner)
  on conflict do nothing;

  return v_conversation;
end;
$$;

grant execute on function public.ensure_errand_conversation(uuid) to authenticated;

-- Allow conversation creation only through the secure RPC above.
-- Direct client inserts are intentionally not permitted.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversations_insert_member') then
    create policy conversations_insert_member on public.conversations
      for insert to authenticated
      with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='conversation_members' and policyname='conversation_members_insert_member') then
    create policy conversation_members_insert_member on public.conversation_members
      for insert to authenticated
      with check (false);
  end if;
end $$;

-- Ensure realtime is enabled for live chat. Safe to run repeatedly.
do $$
begin
  if to_regclass('public.messages') is not null and not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
