-- Managers: Azisly's own staff who run a pod (agreed with Sanjeet, 14 Nov 2026).
-- Added on its own because a new enum value can't be used in the same transaction.
alter type public.user_role add value if not exists 'manager';
