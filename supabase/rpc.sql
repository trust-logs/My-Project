-- Secure server-side state transitions. Run after schema.sql.
-- Money movements should be triggered only after verified payment/provider events.

create or replace function public.accept_errand(p_errand_id uuid, p_runner_id uuid, p_application_id uuid)
returns public.errand_status language plpgsql security definer set search_path=public as $$
declare v_status public.errand_status; v_customer uuid;
begin
 if auth.uid() <> p_runner_id then raise exception 'not authorized'; end if;
 select status, customer_id into v_status, v_customer from public.errands where id=p_errand_id for update;
 if v_status <> 'open' then raise exception 'errand is not open'; end if;
 if exists(select 1 from public.applications where id=p_application_id and errand_id=p_errand_id and runner_id=p_runner_id) is false then raise exception 'application not found'; end if;
 update public.errands set runner_id=p_runner_id,status='accepted',updated_at=now() where id=p_errand_id;
 update public.applications set status='accepted' where id=p_application_id;
 update public.applications set status='rejected' where errand_id=p_errand_id and id<>p_application_id and status='pending';
 insert into public.conversations(errand_id,customer_id,runner_id) values(p_errand_id,v_customer,p_runner_id) on conflict do nothing;
 return 'accepted';
end; $$;

create or replace function public.start_errand(p_errand_id uuid)
returns public.errand_status language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.errands where id=p_errand_id and runner_id=auth.uid() and status='accepted') then raise exception 'not authorized or invalid state'; end if;
 update public.errands set status='in_progress',updated_at=now() where id=p_errand_id;
 return 'in_progress';
end; $$;

create or replace function public.complete_errand(p_errand_id uuid)
returns public.errand_status language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.errands where id=p_errand_id and (runner_id=auth.uid() or customer_id=auth.uid()) and status='in_progress') then raise exception 'not authorized or invalid state'; end if;
 update public.errands set status='completed',completed_at=now(),updated_at=now() where id=p_errand_id;
 return 'completed';
end; $$;

revoke all on function public.accept_errand(uuid,uuid,uuid) from public;
grant execute on function public.accept_errand(uuid,uuid,uuid) to authenticated;
revoke all on function public.start_errand(uuid) from public;
grant execute on function public.start_errand(uuid) to authenticated;
revoke all on function public.complete_errand(uuid) from public;
grant execute on function public.complete_errand(uuid) to authenticated;
