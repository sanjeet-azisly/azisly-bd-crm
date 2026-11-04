-- Phase 1: people, pods, courses, invites, settings + row level security.

create extension if not exists citext;

create type public.user_role as enum ('admin', 'intern');
create type public.course_tier as enum ('Entry', 'Core', 'Premium');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.pods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 40),
  colour text not null default '#2346F5' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  leader_id uuid,
  target_override numeric(12,2) check (target_override is null or target_override >= 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text not null check (char_length(full_name) between 2 and 80),
  role public.user_role not null default 'intern',
  pod_id uuid references public.pods (id) on delete set null,
  referral_code citext unique check (referral_code is null or referral_code ~ '^[A-Za-z0-9]{3,20}$'),
  active boolean not null default true,
  first_login_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pods
  add constraint pods_leader_fk foreign key (leader_id) references public.profiles (id) on delete set null;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  full_name text not null,
  role public.user_role not null default 'intern',
  pod_id uuid references public.pods (id) on delete set null,
  make_leader boolean not null default false,
  invited_by uuid references public.profiles (id) on delete set null,
  email_sent boolean not null default false,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  short_name text not null check (char_length(short_name) between 2 and 30),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  one_line_value text not null default '',
  offer_price numeric(12,2) not null check (offer_price >= 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  typical_close text not null default '',
  tier public.course_tier not null default 'Core',
  who_for text not null default '',
  what_they_get text[] not null default '{}' check (coalesce(array_length(what_they_get, 1), 0) <= 6),
  proof text not null default '',
  pitch text not null default '',
  objections jsonb not null default '[]'::jsonb check (jsonb_typeof(objections) = 'array'),
  brochure_url text,
  payment_url text,
  installments_allowed boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  m1_start date not null default '2026-11-10',
  m2_start date not null default '2026-12-10',
  m3_start date not null default '2027-01-09',
  program_end date not null default '2027-02-07',
  milestone_m1 numeric(12,2) not null default 65000,
  milestone_m2 numeric(12,2) not null default 80000,
  milestone_m3 numeric(12,2) not null default 100000,
  -- Stipend rules (spec 6.4)
  stipend_min numeric(12,2) not null default 10000,        -- below this: ₹0
  stipend_low_rate numeric(5,4) not null default 0.10,     -- 10% up to stipend_low_max
  stipend_low_max numeric(12,2) not null default 65000,
  stipend_mid_fixed numeric(12,2) not null default 15000,  -- fixed up to stipend_mid_max
  stipend_mid_max numeric(12,2) not null default 80000,
  stipend_high_fixed numeric(12,2) not null default 20000, -- above: higher of fixed or rate
  stipend_high_rate numeric(5,4) not null default 0.25,
  target_outreach int not null default 25,
  target_followups int not null default 10,
  target_demos int not null default 1,
  business_target numeric(14,2) not null default 1000000,
  stretch_target numeric(14,2) not null default 2000000,
  monthly_targets jsonb,                                   -- [TBD] e.g. {"M1":..,"M2":..,"M3":..}
  pool_hours int not null default 72 check (pool_hours > 0),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can call them safely)
-- ---------------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin');
$$;

create or replace function public.my_pod_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pod_id from profiles where id = auth.uid() and active;
$$;

create or replace function public.is_pod_leader(p_pod uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pods p join profiles me on me.id = p.leader_id
    where p.id = p_pod and p.leader_id = auth.uid() and me.active
  );
$$;

-- Called right after every login. Stamps first login, accepts the invite and
-- gives the user a referral code (first name + 2 digits) if they have none.
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

  select * into me from profiles where id = auth.uid();
  return me;
end;
$$;

-- A leader must belong to the pod they lead.
create or replace function public.pods_check_leader()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.leader_id is not null and not exists (
    select 1 from profiles where id = new.leader_id and pod_id = new.id and active
  ) then
    raise exception 'The pod leader must be an active member of this pod.';
  end if;
  return new;
end;
$$;

create trigger pods_check_leader
  before insert or update of leader_id on public.pods
  for each row execute function public.pods_check_leader();

-- Moving a leader out of their pod, or deactivating them, unmarks them.
create or replace function public.profiles_unmark_leader()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pod_id is distinct from old.pod_id or (old.active and not new.active) then
    update pods set leader_id = null
    where leader_id = new.id and (id is distinct from new.pod_id or not new.active);
  end if;
  return new;
end;
$$;

create trigger profiles_unmark_leader
  after update of pod_id, active on public.profiles
  for each row execute function public.profiles_unmark_leader();

-- Users may not change their own role, pod, code or status (only admins can).
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

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger courses_updated_at before update on public.courses
  for each row execute function public.touch_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.pods enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.courses enable row level security;
alter table public.settings enable row level security;

-- Pods: everyone on the team can read (leaderboards); only admins write.
create policy pods_read on public.pods for select to authenticated using (public.is_active_user());
create policy pods_admin on public.pods for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: team members can see each other (leaderboards, pods); own name editable; admins do the rest.
create policy profiles_read on public.profiles for select to authenticated
  using (public.is_active_user() or id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Invites: admins only.
create policy invites_admin on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Courses: team reads active ones (admins read all); admins write.
create policy courses_read on public.courses for select to authenticated
  using ((active and public.is_active_user()) or public.is_admin());
create policy courses_admin on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Settings: team reads; admins update.
create policy settings_read on public.settings for select to authenticated using (public.is_active_user());
create policy settings_admin on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Lock helper functions down to signed-in users.
revoke execute on function public.claim_first_login() from public, anon;
grant execute on function public.claim_first_login() to authenticated;
