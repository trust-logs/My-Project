-- Run after schema.sql. Admin access is controlled by the profiles.role column.
-- Do not rely on client-side role checks.
create policy "admins read all profiles" on public.profiles for select using (auth.uid()=id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins read all errands" on public.errands for select using (auth.uid()=customer_id or auth.uid()=runner_id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins update errands" on public.errands for update using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins read applications" on public.applications for select using (auth.uid()=runner_id or exists(select 1 from public.errands e where e.id=errand_id and e.customer_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins read transactions" on public.transactions for select using (auth.uid()=user_id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins read disputes" on public.disputes for select using (auth.uid()=opened_by or exists(select 1 from public.errands e where e.id=errand_id and (e.customer_id=auth.uid() or e.runner_id=auth.uid())) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins update disputes" on public.disputes for update using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
