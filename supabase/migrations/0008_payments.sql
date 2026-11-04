-- Phase 3: payments, verification, notifications, payment screenshots.

create type public.payment_status as enum ('Pending', 'Verified', 'Rejected', 'Refunded');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  -- Credit goes to the lead owner at the time the payment is logged (spec 5.7.7: 100% to owner in v1).
  owner_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid references public.courses (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  paid_on date not null,
  txn_ref text not null check (char_length(txn_ref) between 3 and 100),
  screenshot_path text,
  status public.payment_status not null default 'Pending',
  reason text check (reason is null or char_length(reason) <= 500),
  logged_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  assisted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reason_when_needed check (status not in ('Rejected', 'Refunded') or reason is not null)
);

-- The same transaction can't be claimed twice (rejected ones may be logged again).
create unique index payments_txn_unique on public.payments (lower(txn_ref)) where status <> 'Rejected';
create index payments_lead_idx on public.payments (lead_id);
create index payments_owner_idx on public.payments (owner_id, paid_on);
create index payments_status_idx on public.payments (status, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- See / log payments on any lead you can see: own (intern), own + pod (leader), any (admin).
create policy payments_read on public.payments for select to authenticated
  using (owner_id = auth.uid() or exists (select 1 from public.leads l where l.id = lead_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.is_active_user() and exists (select 1 from public.leads l where l.id = lead_id));
-- Verify / reject / refund: admins only.
create policy payments_admin_update on public.payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.payments to authenticated, service_role;
grant delete on public.payments to service_role;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
revoke all on public.payments, public.notifications from anon;

-- ---------------------------------------------------------------------------

create or replace function public.inr(amount numeric)
returns text language sql immutable as $$
  -- ₹1,50,000 style
  select '₹' || case
    when amount < 1000 then trim(to_char(amount, 'FM999'))
    else regexp_replace(
      regexp_replace(trunc(amount)::bigint::text, '(\d)(?=(\d{2})+\d{3}$)', '\1,', 'g'),
      '(\d)(\d{3})$', '\1,\2')
  end;
$$;

create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l leads;
  installments boolean;
begin
  select * into l from leads where id = new.lead_id;
  if not found then raise exception 'Lead not found.'; end if;

  new.owner_id := l.owner_id;
  new.course_id := coalesce(new.course_id, l.course_id);
  new.logged_by := coalesce(auth.uid(), new.logged_by);
  if auth.uid() is not null then
    new.status := 'Pending';
    new.verified_by := null;
    new.verified_at := null;
    new.reason := null;
  end if;
  if new.paid_on > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'The payment date can’t be in the future.';
  end if;

  -- One payment per lead unless the course allows installments (rejected ones don't count).
  select installments_allowed into installments from courses where id = new.course_id;
  if not coalesce(installments, false) and exists (
    select 1 from payments where lead_id = new.lead_id and status in ('Pending', 'Verified')
  ) then
    raise exception 'This lead already has a payment, and this course doesn’t allow installments.';
  end if;
  return new;
end;
$$;

create trigger payments_before_insert before insert on public.payments
  for each row execute function public.payments_before_insert();

create or replace function public.payments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lead_events (lead_id, user_id, type, note)
  values (new.lead_id, auth.uid(), 'payment',
    inr(new.amount) || ' payment logged · Txn ' || new.txn_ref || ' · Pending verification');
  -- An open lead moves to Payment pending.
  update leads set stage = 'Payment pending'
  where id = new.lead_id and stage in ('New', 'Talking', 'Demo done', 'Lost', 'Nurture');
  return new;
end;
$$;

create trigger payments_after_insert after insert on public.payments
  for each row execute function public.payments_after_insert();

create or replace function public.payments_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if not (
      (old.status = 'Pending' and new.status in ('Verified', 'Rejected'))
      or (old.status = 'Verified' and new.status = 'Refunded')
    ) then
      raise exception 'A % payment can’t be marked %.', old.status, new.status;
    end if;
    if new.status = 'Verified' then
      new.verified_by := auth.uid();
      new.verified_at := now();
      new.reason := null;
    end if;
  end if;
  -- Money facts are fixed once logged.
  if new.amount <> old.amount or new.lead_id <> old.lead_id or new.owner_id <> old.owner_id
     or new.paid_on <> old.paid_on or new.txn_ref <> old.txn_ref then
    raise exception 'Payment details can’t be changed. Reject it and log it again.';
  end if;
  return new;
end;
$$;

create trigger payments_before_update before update on public.payments
  for each row execute function public.payments_before_update();

create or replace function public.payments_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lead_name text;
  live int;
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into lead_name from leads where id = new.lead_id;

  if new.status = 'Verified' then
    -- First verified payment → Won (spec 5.7.4).
    update leads set stage = 'Won', lost_reason = null where id = new.lead_id and stage <> 'Won';
    insert into lead_events (lead_id, user_id, type, note)
    values (new.lead_id, auth.uid(), 'payment', inr(new.amount) || ' payment verified');
    insert into notifications (user_id, text, link)
    values (new.owner_id, 'Your ' || inr(new.amount) || ' payment for ' || lead_name || ' was verified', '/leads/' || new.lead_id);

  elsif new.status = 'Rejected' then
    select count(*) into live from payments where lead_id = new.lead_id and status in ('Pending', 'Verified');
    if live = 0 then
      update leads set stage = 'Payment pending' where id = new.lead_id;
    end if;
    insert into lead_events (lead_id, user_id, type, note)
    values (new.lead_id, auth.uid(), 'payment', inr(new.amount) || ' payment rejected: ' || new.reason);
    insert into notifications (user_id, text, link)
    values (new.owner_id, 'Your ' || inr(new.amount) || ' payment for ' || lead_name || ' was rejected: ' || new.reason, '/leads/' || new.lead_id);

  elsif new.status = 'Refunded' then
    select count(*) into live from payments where lead_id = new.lead_id and status = 'Verified';
    if live = 0 then
      -- Refunded (all payments) → Closed, stage Lost (state matrix).
      update leads set stage = 'Lost', lost_reason = 'Other' where id = new.lead_id;
    end if;
    insert into lead_events (lead_id, user_id, type, note)
    values (new.lead_id, auth.uid(), 'payment', inr(new.amount) || ' payment refunded: ' || new.reason);
    insert into notifications (user_id, text, link)
    values (new.owner_id, 'Your ' || inr(new.amount) || ' payment for ' || lead_name || ' was refunded: ' || new.reason, '/leads/' || new.lead_id);
  end if;
  return new;
end;
$$;

create trigger payments_after_update after update on public.payments
  for each row execute function public.payments_after_update();

-- A lead only becomes Won through a verified payment. Admins can no longer set it by hand
-- unless a verified payment exists.
create or replace function public.leads_won_needs_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'Won' and old.stage is distinct from 'Won' and auth.uid() is not null
     and not exists (select 1 from payments where lead_id = new.id and status = 'Verified') then
    raise exception 'A lead becomes Won when its payment is verified.';
  end if;
  return new;
end;
$$;

create trigger leads_won_needs_payment before update of stage on public.leads
  for each row execute function public.leads_won_needs_payment();

-- ---------------------------------------------------------------------------
-- Leaderboard data: everyone may see verified revenue and lead counts per person
-- (but not the leads or payments themselves).
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard_payments()
returns table (owner_id uuid, amount numeric, paid_on date, lead_id uuid)
language sql stable security definer set search_path = public as $$
  select p.owner_id, p.amount, p.paid_on, p.lead_id
  from payments p
  where p.status = 'Verified' and public.is_active_user();
$$;

create or replace function public.leaderboard_leads()
returns table (owner_id uuid, created_on date, won boolean)
language sql stable security definer set search_path = public as $$
  select l.owner_id, (l.created_at at time zone 'Asia/Kolkata')::date, l.stage = 'Won'
  from leads l
  where public.is_active_user();
$$;

grant execute on function public.leaderboard_payments(), public.leaderboard_leads() to authenticated;
revoke execute on function public.leaderboard_payments(), public.leaderboard_leads() from anon, public;

-- ---------------------------------------------------------------------------
-- Screenshots: private bucket. The app uploads and shows them through the server
-- after checking the person may see the lead, so no direct storage access is granted.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-screenshots', 'payment-screenshots', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
