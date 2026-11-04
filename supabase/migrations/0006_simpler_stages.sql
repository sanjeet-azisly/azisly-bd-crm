-- Simpler pipeline (agreed with Sanjeet, 3 Nov 2026): 4 working steps + 3 outcomes.
--   New → Talking → Demo done → Payment pending → Won / Lost / Nurture
-- Old stages map as: Contacted, Qualified, Discovery done → Talking;
-- Demo / Webinar, Negotiation → Demo done; Payment link sent → Payment pending.
-- Qualification now lives in BANT (Hot / Warm / Cold).

create type public.lead_stage_v2 as enum ('New', 'Talking', 'Demo done', 'Payment pending', 'Won', 'Lost', 'Nurture');

alter table public.leads drop column temperature;
alter table public.leads drop constraint lost_needs_reason;
drop function public.find_lead_by_phone(text);
alter table public.leads alter column stage drop default;

alter table public.leads alter column stage type public.lead_stage_v2 using (
  case stage::text
    when 'Contacted' then 'Talking'
    when 'Qualified' then 'Talking'
    when 'Discovery done' then 'Talking'
    when 'Demo / Webinar' then 'Demo done'
    when 'Negotiation' then 'Demo done'
    when 'Payment link sent' then 'Payment pending'
    else stage::text
  end
)::public.lead_stage_v2;

drop type public.lead_stage;
alter type public.lead_stage_v2 rename to lead_stage;

alter table public.leads alter column stage set default 'New';
alter table public.leads add constraint lost_needs_reason
  check (stage <> 'Lost'::public.lead_stage or lost_reason is not null);
alter table public.leads add column temperature text generated always as (
  case
    when stage = 'Won'::public.lead_stage then 'Won'
    when stage in ('Lost'::public.lead_stage, 'Nurture'::public.lead_stage) then 'Closed'
    when (bant_b::int + bant_a::int + bant_n::int + bant_t::int) = 4 then 'Hot'
    when (bant_b::int + bant_a::int + bant_n::int + bant_t::int) >= 2 then 'Warm'
    else 'Cold'
  end
) stored;

-- Old timeline entries keep their old stage names as plain text; that's fine.

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

-- Touches now move leads forward by themselves (never backwards):
--   first call / WhatsApp on a New lead → Talking; a demo → Demo done.
create or replace function public.log_touch(p_lead uuid, p_type text, p_note text, p_next date)
returns public.leads language plpgsql security invoker set search_path = public as $$
declare
  l leads;
  kind text;
  next_stage lead_stage;
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

  next_stage := case
    when p_type = 'demo' and l.stage in ('New', 'Talking') then 'Demo done'::lead_stage
    when p_type in ('call', 'whatsapp') and l.stage = 'New' then 'Talking'::lead_stage
    else l.stage
  end;

  insert into lead_events (lead_id, user_id, type, note, counts_as)
  values (p_lead, auth.uid(), p_type, nullif(trim(p_note), ''), kind);

  update leads set
    touches = touches + 1,
    last_touched_at = now(),
    next_follow_up = p_next,
    stage = next_stage
  where id = p_lead
  returning * into l;
  return l;
end;
$$;

grant execute on function public.find_lead_by_phone(text) to authenticated, service_role;
revoke execute on function public.find_lead_by_phone(text) from anon, public;
