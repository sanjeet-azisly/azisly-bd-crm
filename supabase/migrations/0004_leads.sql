-- Phase 2: leads, their timeline, BANT temperature, stages, touches and follow-ups.

create type public.lead_stage as enum (
  'New', 'Contacted', 'Qualified', 'Discovery done', 'Demo / Webinar', 'Negotiation',
  'Payment link sent', 'Won', 'Lost', 'Nurture'
);
create type public.lead_persona as enum (
  'Student', 'Fresh graduate', 'Working professional', 'Parent', 'College (B2B)', 'Corporate (B2B)'
);
create type public.lead_source as enum (
  'Campus', 'WhatsApp', 'LinkedIn', 'Instagram', 'Fests & events', 'Alumni', 'Referral', 'Webinar',
  'Course page', 'Company-provided', 'B2B meeting'
);
create type public.lost_reason as enum ('Price', 'Not interested', 'No response', 'Chose another option', 'Other');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  pod_id uuid references public.pods (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  persona public.lead_persona,
  college text check (college is null or char_length(college) <= 120),
  city text check (city is null or char_length(city) <= 80),
  source public.lead_source not null,
  course_id uuid references public.courses (id) on delete set null,
  bant_b boolean not null default false,
  bant_a boolean not null default false,
  bant_n boolean not null default false,
  bant_t boolean not null default false,
  stage public.lead_stage not null default 'New',
  lost_reason public.lost_reason,
  touches int not null default 0 check (touches >= 0),
  last_touched_at timestamptz,
  next_follow_up date,
  help_requested boolean not null default false,
  stage_changed_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Spec 5.4.2e: 4 Yes = Hot, 2–3 = Warm, 0–1 = Cold; Won / Closed override.
  temperature text generated always as (
    case
      when stage = 'Won'::public.lead_stage then 'Won'
      when stage in ('Lost'::public.lead_stage, 'Nurture'::public.lead_stage) then 'Closed'
      when (bant_b::int + bant_a::int + bant_n::int + bant_t::int) = 4 then 'Hot'
      when (bant_b::int + bant_a::int + bant_n::int + bant_t::int) >= 2 then 'Warm'
      else 'Cold'
    end
  ) stored,
  constraint lost_needs_reason check (stage <> 'Lost'::public.lead_stage or lost_reason is not null)
);

-- Rule 6.1: one lead per phone number across the whole CRM (numbers are stored as 10 digits).
create unique index leads_phone_unique on public.leads (phone);
create index leads_owner_idx on public.leads (owner_id);
create index leads_pod_idx on public.leads (pod_id);
create index leads_follow_up_idx on public.leads (next_follow_up);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in (
    'created', 'call', 'whatsapp', 'demo', 'note', 'stage_change', 'reassign',
    'payment', 'help', 'interest_again'
  )),
  note text check (note is null or char_length(note) <= 2000),
  -- What this touch counts as on the daily activity strip.
  counts_as text check (counts_as in ('outreach', 'followup', 'demo')),
  created_at timestamptz not null default now()
);

create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
create index lead_events_user_day_idx on public.lead_events (user_id, created_at) where counts_as is not null;

-- ---------------------------------------------------------------------------
-- Who can see a lead: its owner, the leader of its pod, and admins.
-- ---------------------------------------------------------------------------

create or replace function public.can_see_lead(p_owner uuid, p_pod uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and (
    p_owner = auth.uid() or public.is_admin() or (p_pod is not null and public.is_pod_leader(p_pod))
  );
$$;

alter table public.leads enable row level security;
alter table public.lead_events enable row level security;

create policy leads_read on public.leads for select to authenticated
  using (public.can_see_lead(owner_id, pod_id));
-- Interns add leads for themselves; admins for anyone.
create policy leads_insert on public.leads for insert to authenticated
  with check (public.is_active_user() and (owner_id = auth.uid() or public.is_admin()));
create policy leads_update on public.leads for update to authenticated
  using (public.can_see_lead(owner_id, pod_id))
  with check (public.is_active_user());
create policy leads_delete on public.leads for delete to authenticated using (public.is_admin());

create policy lead_events_read on public.lead_events for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy lead_events_insert on public.lead_events for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.leads l where l.id = lead_id));

-- ---------------------------------------------------------------------------
-- Triggers: pod follows owner, reassignment rules, stage bookkeeping, timeline.
-- ---------------------------------------------------------------------------

create or replace function public.leads_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := coalesce(new.owner_id, auth.uid());
  new.created_by := coalesce(new.created_by, auth.uid());
  select pod_id into new.pod_id from profiles where id = new.owner_id;
  new.touches := 0;
  new.stage_changed_at := now();
  if new.stage = 'Won' and auth.uid() is not null then
    raise exception 'A lead becomes Won when its payment is verified.';
  end if;
  return new;
end;
$$;

create trigger leads_before_insert before insert on public.leads
  for each row execute function public.leads_before_insert();

create or replace function public.leads_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if new.owner_id is distinct from old.owner_id then
    if auth.uid() is not null and not public.is_admin() then
      if not (
        old.pod_id is not null and public.is_pod_leader(old.pod_id)
        and exists (select 1 from profiles where id = new.owner_id and pod_id = old.pod_id and active)
      ) then
        raise exception 'You can only reassign leads to members of your own pod.';
      end if;
    end if;
    select pod_id into new.pod_id from profiles where id = new.owner_id;
  elsif new.pod_id is distinct from old.pod_id and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can move a lead to another pod.';
  end if;

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage <> 'Lost' then new.lost_reason := null; end if;
    if new.stage = 'Won' and auth.uid() is not null and not public.is_admin() then
      raise exception 'A lead becomes Won when its payment is verified.';
    end if;
  end if;

  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'These fields can’t be changed.';
  end if;
  return new;
end;
$$;

create trigger leads_before_update before update on public.leads
  for each row execute function public.leads_before_update();

create or replace function public.leads_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_name text;
  new_name text;
begin
  if tg_op = 'INSERT' then
    insert into lead_events (lead_id, user_id, type, note)
    values (new.id, auth.uid(), 'created', 'Lead added · Source: ' || new.source);
    return new;
  end if;

  if new.stage is distinct from old.stage then
    insert into lead_events (lead_id, user_id, type, note)
    values (new.id, auth.uid(), 'stage_change',
      old.stage || ' → ' || new.stage || coalesce(' (' || new.lost_reason || ')', ''));
  end if;
  if new.owner_id is distinct from old.owner_id then
    select full_name into old_name from profiles where id = old.owner_id;
    select full_name into new_name from profiles where id = new.owner_id;
    insert into lead_events (lead_id, user_id, type, note)
    values (new.id, auth.uid(), 'reassign', 'Reassigned from ' || coalesce(old_name, '?') || ' to ' || coalesce(new_name, '?'));
  end if;
  return new;
end;
$$;

create trigger leads_after_write after insert or update on public.leads
  for each row execute function public.leads_after_write();

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Spec 5.4.4: a touch adds a timeline entry, bumps Touches, updates last touched
-- and sets the next follow-up. The first call / WhatsApp counts as outreach.
create or replace function public.log_touch(p_lead uuid, p_type text, p_note text, p_next date)
returns public.leads language plpgsql security invoker set search_path = public as $$
declare
  l leads;
  kind text;
begin
  if p_type not in ('call', 'whatsapp', 'demo', 'note') then
    raise exception 'Unknown touch type.';
  end if;
  select * into l from leads where id = p_lead for update;
  if not found then
    raise exception 'Lead not found.';
  end if;

  kind := case
    when p_type = 'demo' then 'demo'
    when p_type in ('call', 'whatsapp') then case when l.touches = 0 then 'outreach' else 'followup' end
  end;

  insert into lead_events (lead_id, user_id, type, note, counts_as)
  values (p_lead, auth.uid(), p_type, nullif(trim(p_note), ''), kind);

  update leads set
    touches = touches + 1,
    last_touched_at = now(),
    next_follow_up = p_next,
    stage = case when stage = 'New' and p_type <> 'note' then 'Contacted'::lead_stage else stage end
  where id = p_lead
  returning * into l;
  return l;
end;
$$;

-- Duplicate check across the whole CRM (spec 5.3h). Reveals only the owner's
-- name and the stage; the lead id only to people allowed to open it.
create or replace function public.find_lead_by_phone(p_phone text)
returns table (lead_id uuid, owner_name text, stage public.lead_stage)
language sql stable security definer set search_path = public as $$
  select
    case when public.can_see_lead(l.owner_id, l.pod_id) then l.id end,
    p.full_name,
    l.stage
  from leads l join profiles p on p.id = l.owner_id
  where l.phone = p_phone and public.is_active_user();
$$;

grant select, insert, update, delete on public.leads, public.lead_events to authenticated, service_role;
revoke all on public.leads, public.lead_events from anon;
grant execute on function
  public.can_see_lead(uuid, uuid), public.log_touch(uuid, text, text, date), public.find_lead_by_phone(text)
to authenticated, service_role;
revoke execute on function public.log_touch(uuid, text, text, date), public.find_lead_by_phone(text) from anon, public;
