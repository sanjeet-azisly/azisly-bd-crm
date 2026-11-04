-- Optional email on leads (phone stays required and is still the duplicate check).
alter table public.leads
  add column email text check (
    email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );
