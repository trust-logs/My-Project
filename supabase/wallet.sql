-- Secure wallet credit called only by the payment webhook using the service role.
create or replace function public.credit_wallet_after_verified_payment(p_user_id uuid,p_amount numeric,p_currency char(3),p_transaction_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user_id and currency=p_currency;
 if not found then insert into public.wallets(user_id,currency,balance) values(p_user_id,p_currency,p_amount); end if;
end; $$;
revoke all on function public.credit_wallet_after_verified_payment(uuid,numeric,char,uuid) from public, authenticated;
