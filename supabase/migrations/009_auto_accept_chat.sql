-- ERRANDGO ACCEPTED-ERRAND CHAT AUTOMATION
-- When a customer accepts a runner, automatically create the 1-to-1 conversation,
-- add both participants, notify the runner, and post a platform instruction message.
-- Safe to run once in Supabase SQL Editor.

create or replace function public.accepted_errand_chat_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_title text;
  v_budget numeric;
  v_currency text;
  v_pickup text;
  v_delivery text;
  v_customer_name text;
  v_runner_name text;
begin
  -- Only act when an application actually becomes accepted and a runner exists.
  if new.status <> 'accepted' or new.runner_id is null then
    return new;
  end if;

  select e.title, e.budget, e.currency, e.pickup_address, e.delivery_address,
         e.customer_id, p.full_name
    into v_title, v_budget, v_currency, v_pickup, v_delivery, v_customer_name
  from public.errands e
  left join public.profiles p on p.id = e.customer_id
  where e.id = new.errand_id;

  if v_title is null then
    return new;
  end if;

  v_customer_name := coalesce(v_customer_name, 'Requester');

  select id into v_conversation
  from public.conversations
  where errand_id = new.errand_id
  order by created_at asc
  limit 1;

  if v_conversation is null then
    insert into public.conversations(errand_id)
    values (new.errand_id)
    returning id into v_conversation;
  end if;

  insert into public.conversation_members(conversation_id, user_id)
  select v_conversation, e.customer_id
  from public.errands e
  where e.id = new.errand_id
  on conflict do nothing;

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation, new.runner_id)
  on conflict do nothing;

  -- One automated instruction message per accepted errand.
  if not exists (
    select 1 from public.messages
    where conversation_id = v_conversation
      and message like 'ERRANDGO AUTOMATED INSTRUCTIONS:%'
  ) then
    insert into public.messages(conversation_id, sender_id, message)
    select
      v_conversation,
      e.customer_id,
      'ERRANDGO AUTOMATED INSTRUCTIONS:\n\nYour errand has been accepted and this private chat is now active.\n\n1. Keep all communication inside ErrandGo.\n2. Confirm the errand details before starting.\n3. Use the chat to agree on pickup, delivery and timing.\n4. Never share passwords, PINs, OTPs or other sensitive credentials.\n5. Keep proof, updates and important information in this chat.\n6. If there is a problem, use ErrandGo support/dispute tools rather than moving the transaction off-platform.\n\nErrand: ' || e.title ||
      '\nBudget: ' || coalesce(e.currency, 'NGN') || ' ' || to_char(e.budget, 'FM999,999,999,990.00') ||
      '\nPickup: ' || coalesce(nullif(e.pickup_address, ''), 'Not specified') ||
      '\nDelivery: ' || coalesce(nullif(e.delivery_address, ''), 'Not specified') ||
      '\n\nPlease confirm the details with your counterpart before proceeding.'
    from public.errands e
    where e.id = new.errand_id;
  end if;

  insert into public.notifications(user_id, title, body, type, data)
  values (
    new.runner_id,
    'Errand accepted — chat is ready',
    'Your application for "' || v_title || '" was accepted. Open Messages to continue with the requester.',
    'errand_accepted',
    jsonb_build_object('errand_id', new.errand_id, 'conversation_id', v_conversation)
  );

  update public.conversations
  set updated_at = now()
  where id = v_conversation;

  return new;
end;
$$;

drop trigger if exists trg_accepted_errand_chat_automation on public.applications;
create trigger trg_accepted_errand_chat_automation
after update of status on public.applications
for each row
when (new.status = 'accepted')
execute function public.accepted_errand_chat_automation();

grant execute on function public.accepted_errand_chat_automation() to authenticated;
