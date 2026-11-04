-- Phase 5: help requests, the pool, claiming.

-- ---------------------------------------------------------------------------
-- Help requests (spec 5.4.7, 5.9.3)
-- ---------------------------------------------------------------------------

create type public.help_reason as enum ('Parent call', 'Price objection', 'Demo needed', 'Other');
create type public.help_status as enum ('Open', 'Taken', 'Handled');

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  pod_id uuid references public.pods (id) on delete set null,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  reason public.help_reason not null,
  note text check (note is null or char_length(note) <= 1000),
  status public.help_status not null default 'Open',
  helper_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  taken_at timestamptz,
  handled_at timestamptz
);
create index help_requests_pod_idx on public.help_requests (pod_id, status, created_at);
create index help_requests_lead_idx on public.help_requests (lead_id);

alter table public.help_requests enable row level security;

create policy help_read on public.help_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_admin() or (pod_id is not null and public.is_pod_leader(pod_id)));
-- Pod members ask for help on leads they can see.
create policy help_insert on public.help_requests for insert to authenticated
  with check (
    requested_by = auth.uid() and public.is_active_user()
    and exists (select 1 from public.leads l where l.id = lead_id)
  );
-- The pod leader (or an admin) takes and closes requests.
create policy help_update on public.help_requests for update to authenticated
  using (public.is_admin() or (pod_id is not null and public.is_pod_leader(pod_id)))
  with check (public.is_admin() or (pod_id is not null and public.is_pod_leader(pod_id)));

grant select, insert, update on public.help_requests to authenticated, service_role;
grant delete on public.help_requests to service_role;
revoke all on public.help_requests from anon;

create or replace function public.help_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select pod_id into new.pod_id from leads where id = new.lead_id;
    if new.pod_id is null then
      raise exception 'This lead isn’t in a pod, so there’s no pod leader to ask.';
    end if;
    if not exists (select 1 from pods where id = new.pod_id and leader_id is not null) then
      raise exception 'Your pod doesn’t have a leader yet. Ask your admin.';
    end if;
    new.status := 'Open';
    new.helper_id := null;
    return new;
  end if;
  -- Update
  if new.status = 'Taken' and old.status = 'Open' then
    new.helper_id := coalesce(new.helper_id, auth.uid());
    new.taken_at := now();
  elsif new.status = 'Handled' and old.status <> 'Handled' then
    new.helper_id := coalesce(new.helper_id, old.helper_id, auth.uid());
    new.handled_at := now();
  elsif new.status is distinct from old.status then
    raise exception 'A % help request can’t go back to %.', old.status, new.status;
  end if;
  if new.lead_id <> old.lead_id or new.requested_by <> old.requested_by or new.reason <> old.reason then
    raise exception 'Help request details can’t be changed.';
  end if;
  return new;
end;
$$;

create trigger help_before_write before insert or update on public.help_requests
  for each row execute function public.help_before_write();

create or replace function public.help_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  leader uuid;
  asker text;
  helper text;
  lead_name text;
begin
  select name into lead_name from leads where id = new.lead_id;
  if tg_op = 'INSERT' then
    update leads set help_requested = true where id = new.lead_id;
    select full_name into asker from profiles where id = new.requested_by;
    insert into lead_events (lead_id, user_id, type, note)
    values (new.lead_id, new.requested_by, 'help', 'Asked for help: ' || new.reason || coalesce(' – ' || new.note, ''));
    select leader_id into leader from pods where id = new.pod_id;
    if leader is not null and leader <> new.requested_by then
      insert into notifications (user_id, text, link)
      values (leader, asker || ' asked for help on ' || lead_name || ' (' || new.reason || ')', '/pod');
    end if;
  elsif new.status is distinct from old.status then
    select full_name into helper from profiles where id = new.helper_id;
    if new.status = 'Taken' then
      insert into lead_events (lead_id, user_id, type, note)
      values (new.lead_id, auth.uid(), 'help', coalesce(helper, 'Pod leader') || ' is helping (' || new.reason || ')');
      insert into notifications (user_id, text, link)
      values (new.requested_by, coalesce(helper, 'Your pod leader') || ' is helping with ' || lead_name, '/leads/' || new.lead_id);
    elsif new.status = 'Handled' then
      insert into lead_events (lead_id, user_id, type, note)
      values (new.lead_id, auth.uid(), 'help', 'Help request handled (' || new.reason || ')');
      if not exists (select 1 from help_requests where lead_id = new.lead_id and status <> 'Handled') then
        update leads set help_requested = false where id = new.lead_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger help_after_write after insert or update on public.help_requests
  for each row execute function public.help_after_write();

-- ---------------------------------------------------------------------------
-- The pool (rule 6.2): an open lead with no touch for pool_hours, or whose owner
-- was deactivated, can be claimed by anyone in its pod.
-- ---------------------------------------------------------------------------

-- The pool clock restarts when a lead changes hands, so a claimed lead isn't instantly back in the pool.
alter table public.leads add column assigned_at timestamptz not null default now();
update public.leads set assigned_at = created_at;

create or replace function public.leads_assigned_at()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    new.assigned_at := now();
  end if;
  return new;
end;
$$;

create trigger leads_assigned_at before update of owner_id on public.leads
  for each row execute function public.leads_assigned_at();

create or replace function public.lead_in_pool(l public.leads)
returns boolean language sql stable security definer set search_path = public as $$
  select l.stage in ('New', 'Talking', 'Demo done', 'Payment pending')
    and (
      not exists (select 1 from profiles p where p.id = l.owner_id and p.active)
      or greatest(coalesce(l.last_touched_at, l.created_at), l.assigned_at)
         < now() - make_interval(hours => (select pool_hours from settings where id = 1))
    );
$$;

-- The pool for the caller's pod (admins: every pod, or one pod).
create or replace function public.pool_leads(p_pod uuid default null)
returns table (
  id uuid, name text, pod_id uuid, owner_name text, owner_active boolean, stage public.lead_stage,
  temperature text, course_short text, source public.lead_source, touches int,
  last_touched_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.pod_id, p.full_name, p.active, l.stage, l.temperature, c.short_name, l.source, l.touches,
         l.last_touched_at, l.created_at
  from leads l
  join profiles p on p.id = l.owner_id
  left join courses c on c.id = l.course_id
  where public.lead_in_pool(l)
    and public.is_active_user()
    and (
      (public.is_admin() and (p_pod is null or l.pod_id = p_pod))
      or (not public.is_admin() and l.pod_id = public.my_pod_id())
    )
  order by greatest(coalesce(l.last_touched_at, l.created_at), l.assigned_at);
$$;

-- Claim a pool lead: it becomes yours (logged on the timeline as a reassignment).
create or replace function public.claim_lead(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  select * into l from leads where id = p_lead for update;
  if not found or not public.is_active_user() then
    raise exception 'Lead not found.';
  end if;
  if not public.lead_in_pool(l) then
    raise exception 'This lead isn’t in the pool any more.';
  end if;
  if not public.is_admin() and l.pod_id is distinct from public.my_pod_id() then
    raise exception 'You can only claim leads from your own pod’s pool.';
  end if;
  if l.owner_id = auth.uid() then
    raise exception 'This is already your lead – log a touch to keep it out of the pool.';
  end if;
  -- Bypass the "only admins / pod leaders reassign" rule for this one, checked move.
  perform set_config('app.claiming_lead', 'on', true);
  update leads set owner_id = auth.uid() where id = p_lead;
  perform set_config('app.claiming_lead', 'off', true);
end;
$$;

-- Teach the reassignment guard about claiming.
create or replace function public.leads_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if new.owner_id is distinct from old.owner_id then
    if auth.uid() is not null and not public.is_admin()
       and coalesce(current_setting('app.claiming_lead', true), '') <> 'on' then
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
  end if;

  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'These fields can’t be changed.';
  end if;
  return new;
end;
$$;

grant execute on function public.pool_leads(uuid), public.claim_lead(uuid), public.lead_in_pool(public.leads) to authenticated;
revoke execute on function public.pool_leads(uuid), public.claim_lead(uuid), public.lead_in_pool(public.leads) from anon, public;
