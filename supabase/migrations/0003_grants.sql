-- Newer Supabase projects don't expose tables to the API automatically.
-- Grant table access to signed-in users and the server; row level security
-- policies still decide which rows each person can see or change.
-- Prospects (anon) get nothing directly; the public course page goes through the server.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.pods, public.profiles, public.invites, public.courses, public.settings
to authenticated, service_role;

grant execute on function
  public.is_active_user(), public.is_admin(), public.my_pod_id(), public.is_pod_leader(uuid), public.claim_first_login()
to authenticated, service_role;

revoke all on
  public.pods, public.profiles, public.invites, public.courses, public.settings
from anon;
