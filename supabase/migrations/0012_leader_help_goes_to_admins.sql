-- A pod leader is also a working intern. When the leader asks for help on their own lead,
-- the request goes to the admins (they see it in Pod view → Help queue and get notified).
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
      -- The leader asked (or the pod has no leader): tell every active admin.
      insert into notifications (user_id, text, link)
      select p.id, asker || ' (pod leader) asked for help on ' || lead_name || ' (' || new.reason || ')', '/pod?pod=' || new.pod_id
      from profiles p where p.role = 'admin' and p.active;
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

-- Pods without a leader can still raise help (it goes to the admins).
create or replace function public.help_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select pod_id into new.pod_id from leads where id = new.lead_id;
    if new.pod_id is null then
      raise exception 'This lead isn’t in a pod yet. Ask your admin to put you in a pod.';
    end if;
    new.status := 'Open';
    new.helper_id := null;
    return new;
  end if;
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
