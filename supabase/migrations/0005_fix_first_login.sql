-- Fix: the profile guard blocked claim_first_login from giving interns their
-- referral code. claim_first_login now marks itself so the guard lets it through.

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
       or new.email is distinct from old.email then
      raise exception 'Only an admin can change this.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.claim_first_login()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  base text;
  candidate text;
  tries int := 0;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or not me.active then
    return null;
  end if;

  -- Only for the rest of this transaction.
  perform set_config('app.claiming_first_login', 'on', true);

  if me.referral_code is null then
    base := regexp_replace(split_part(trim(me.full_name), ' ', 1), '[^A-Za-z0-9]', '', 'g');
    if char_length(base) < 2 then base := 'Azisly'; end if;
    base := initcap(left(base, 16));
    loop
      candidate := base || lpad((floor(random() * 90) + 10)::int::text, 2, '0');
      exit when not exists (select 1 from profiles where referral_code = candidate);
      tries := tries + 1;
      if tries > 80 then
        candidate := base || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
        exit when not exists (select 1 from profiles where referral_code = candidate);
      end if;
    end loop;
    update profiles set referral_code = candidate where id = me.id;
  end if;

  update profiles set first_login_at = coalesce(first_login_at, now()) where id = me.id;
  update invites set accepted_at = coalesce(accepted_at, now()) where email = me.email;

  perform set_config('app.claiming_first_login', 'off', true);

  select * into me from profiles where id = auth.uid();
  return me;
end;
$$;
