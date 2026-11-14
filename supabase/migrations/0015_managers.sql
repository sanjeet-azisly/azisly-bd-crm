-- Managers run one pod each. The admin switches extra powers on per manager,
-- and joining links let people set their own password (no email needed).

-- ---------------------------------------------------------------------------
-- New profile fields
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column permissions text[] not null default '{}'
    check (permissions <@ array['approve_payments', 'manage_team', 'export', 'flags', 'courses']::text[]),
  add column commission_pct numeric(5,2)
    check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100));

-- Today's pod leaders become managers with the usual powers.
update public.profiles
set role = 'manager', permissions = array['manage_team', 'export', 'flags']
where role = 'intern' and id in (select leader_id from public.pods where leader_id is not null);

-- Joining links: only a hash of the secret is stored.
alter table public.invites
  add column join_token_hash text unique,
  add column join_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'manager');
$$;

-- Admins have every permission; managers have the ones the admin switched on.
create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role = 'admin' or (role = 'manager' and p = any(permissions)))
  );
$$;

grant execute on function public.is_manager(), public.has_perm(text) to authenticated, service_role;
revoke execute on function public.is_manager(), public.has_perm(text) from anon, public;

-- The head of a pod must be an active manager in that pod.
create or replace function public.pods_check_leader()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.leader_id is not null and not exists (
    select 1 from profiles where id = new.leader_id and pod_id = new.id and active and role = 'manager'
  ) then
    raise exception 'The pod’s manager must be an active manager in this pod.';
  end if;
  return new;
end;
$$;

-- Moving, deactivating or changing someone's role away from manager unmarks them.
create or replace function public.profiles_unmark_leader()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pod_id is distinct from old.pod_id or (old.active and not new.active) or new.role <> 'manager' then
    update pods set leader_id = null
    where leader_id = new.id and (id is distinct from new.pod_id or not new.active or new.role <> 'manager');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_unmark_leader on public.profiles;
create trigger profiles_unmark_leader
  after update of pod_id, active, role on public.profiles
  for each row execute function public.profiles_unmark_leader();

-- Only admins (or the server) change roles, pods, powers and photos.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('app.claiming_first_login', true), '') <> 'on' then
    if new.role is distinct from old.role
       or new.pod_id is distinct from old.pod_id
       or new.referral_code is distinct from old.referral_code
       or new.active is distinct from old.active
       or new.email is distinct from old.email
       or new.photo_path is distinct from old.photo_path
       or new.photo_updated_at is distinct from old.photo_updated_at
       or new.permissions is distinct from old.permissions
       or new.commission_pct is distinct from old.commission_pct then
      raise exception 'Only an admin can change this.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments: managers with "approve payments" verify or reject their pod's
-- pending payments (never their own). Refunds stay with admins.
-- ---------------------------------------------------------------------------
create or replace function public.can_approve_payment(p_lead uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner <> auth.uid() and public.has_perm('approve_payments') and exists (
    select 1 from leads l where l.id = p_lead and l.pod_id is not null and public.is_pod_leader(l.pod_id)
  );
$$;
grant execute on function public.can_approve_payment(uuid, uuid) to authenticated;
revoke execute on function public.can_approve_payment(uuid, uuid) from anon, public;

drop policy if exists payments_admin_update on public.payments;
create policy payments_update on public.payments for update to authenticated
  using (public.is_admin() or (status = 'Pending' and public.can_approve_payment(lead_id, owner_id)))
  with check (public.is_admin() or (status in ('Verified', 'Rejected') and public.can_approve_payment(lead_id, owner_id)));

-- ---------------------------------------------------------------------------
-- Flagged duplicates: managers with "flags" see the ones that touch their pod.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_flag(p_lead uuid, p_attempted_by uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.has_perm('flags') and (
      exists (select 1 from leads l where l.id = p_lead and l.pod_id is not null and public.is_pod_leader(l.pod_id))
      or exists (select 1 from profiles a where a.id = p_attempted_by and a.pod_id is not null and public.is_pod_leader(a.pod_id))
    )
  );
$$;
grant execute on function public.can_see_flag(uuid, uuid) to authenticated;
revoke execute on function public.can_see_flag(uuid, uuid) from anon, public;

drop policy if exists duplicates_admin_read on public.duplicate_attempts;
drop policy if exists duplicates_admin_update on public.duplicate_attempts;
create policy duplicates_read on public.duplicate_attempts for select to authenticated
  using (public.can_see_flag(lead_id, attempted_by));
create policy duplicates_update on public.duplicate_attempts for update to authenticated
  using (public.can_see_flag(lead_id, attempted_by)) with check (public.can_see_flag(lead_id, attempted_by));

-- ---------------------------------------------------------------------------
-- Courses: managers with "courses" edit course setup (not delete).
-- ---------------------------------------------------------------------------
drop policy if exists courses_read on public.courses;
drop policy if exists courses_admin on public.courses;
create policy courses_read on public.courses for select to authenticated
  using ((active and public.is_active_user()) or public.has_perm('courses'));
create policy courses_insert on public.courses for insert to authenticated with check (public.has_perm('courses'));
create policy courses_update on public.courses for update to authenticated
  using (public.has_perm('courses')) with check (public.has_perm('courses'));
create policy courses_delete on public.courses for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Help requests: wording now says "manager".
-- ---------------------------------------------------------------------------
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
    else
      -- The manager asked (or the pod has no manager): tell every active admin.
      insert into notifications (user_id, text, link)
      select p.id, asker || ' asked for help on ' || lead_name || ' (' || new.reason || ')', '/pod?pod=' || new.pod_id
      from profiles p where p.role = 'admin' and p.active;
    end if;
  elsif new.status is distinct from old.status then
    select full_name into helper from profiles where id = new.helper_id;
    if new.status = 'Taken' then
      insert into lead_events (lead_id, user_id, type, note)
      values (new.lead_id, auth.uid(), 'help', coalesce(helper, 'Manager') || ' is helping (' || new.reason || ')');
      insert into notifications (user_id, text, link)
      values (new.requested_by, coalesce(helper, 'Your manager') || ' is helping with ' || lead_name, '/leads/' || new.lead_id);
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
