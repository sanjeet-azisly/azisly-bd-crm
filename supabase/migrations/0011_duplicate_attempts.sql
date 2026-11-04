-- Flag redundant leads: every attempt to add a number that's already in the CRM is
-- logged for the admin (Admin → Flagged leads). Agreed with Sanjeet, 3 Nov 2026.

create table public.duplicate_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,  -- the lead that already has this number
  phone text not null,
  attempted_name text,
  attempted_email text,
  via text not null check (via in ('add_lead', 'edit_lead', 'course_page')),
  attempted_by uuid references public.profiles (id) on delete set null,  -- null when a prospect used a course page
  referrer_id uuid references public.profiles (id) on delete set null,   -- course page: whose link it was
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_by uuid references public.profiles (id) on delete set null
);
create index duplicate_attempts_open_idx on public.duplicate_attempts (created_at desc) where dismissed_at is null;
create index duplicate_attempts_lead_idx on public.duplicate_attempts (lead_id);

alter table public.duplicate_attempts enable row level security;

-- Admins only. Team members record attempts through log_duplicate_attempt() below.
create policy duplicates_admin_read on public.duplicate_attempts for select to authenticated using (public.is_admin());
create policy duplicates_admin_update on public.duplicate_attempts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, update on public.duplicate_attempts to authenticated;
grant select, insert, update, delete on public.duplicate_attempts to service_role;
revoke all on public.duplicate_attempts from anon;

-- Called by the app when Add lead / Edit lead is blocked as a duplicate.
-- Repeats by the same person for the same number within an hour are counted once.
create or replace function public.log_duplicate_attempt(p_phone text, p_name text, p_email text, p_via text)
returns void language plpgsql security definer set search_path = public as $$
declare
  existing uuid;
begin
  if not public.is_active_user() or p_via not in ('add_lead', 'edit_lead') then
    return;
  end if;
  select id into existing from leads where phone = p_phone;
  if existing is null then
    return;
  end if;
  if exists (
    select 1 from duplicate_attempts
    where lead_id = existing and attempted_by = auth.uid() and created_at > now() - interval '1 hour'
  ) then
    return;
  end if;
  insert into duplicate_attempts (lead_id, phone, attempted_name, attempted_email, via, attempted_by)
  values (existing, p_phone, left(nullif(trim(p_name), ''), 80), left(nullif(trim(p_email), ''), 254), p_via, auth.uid());
end;
$$;

grant execute on function public.log_duplicate_attempt(text, text, text, text) to authenticated;
revoke execute on function public.log_duplicate_attempt(text, text, text, text) from anon, public;
