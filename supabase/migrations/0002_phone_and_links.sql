-- Team members' phone numbers (from the bulk upload sheet) and when a login link was last sent.

alter table public.profiles
  add column phone text check (phone is null or phone ~ '^[0-9]{10}$');

alter table public.invites
  add column phone text check (phone is null or phone ~ '^[0-9]{10}$'),
  add column link_sent_at timestamptz;

-- Phone is a contact detail the person may correct themselves.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
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
