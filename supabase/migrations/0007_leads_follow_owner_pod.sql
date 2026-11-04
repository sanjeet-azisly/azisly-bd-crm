-- When someone moves pod, their leads move with them (so the right pod leader sees them).
create or replace function public.profiles_move_leads()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pod_id is distinct from old.pod_id then
    update leads set pod_id = new.pod_id where owner_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_move_leads
  after update of pod_id on public.profiles
  for each row execute function public.profiles_move_leads();

-- Fix leads that are already out of step with their owner's pod.
update public.leads l set pod_id = p.pod_id
from public.profiles p
where p.id = l.owner_id and l.pod_id is distinct from p.pod_id;
