-- ID card photos: each team member uploads one passport-size photo.
-- The app crops it to 35:45 in the browser and saves it through the server, so
-- no direct storage access is granted; admins see them through short-lived links.

alter table public.profiles
  add column photo_path text,
  add column photo_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-photos', 'id-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Only the server (or an admin) may change the photo fields, so nobody can point
-- their profile at someone else's file.
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
       or new.photo_updated_at is distinct from old.photo_updated_at then
      raise exception 'Only an admin can change this.';
    end if;
  end if;
  return new;
end;
$$;
