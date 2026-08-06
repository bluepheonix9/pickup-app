-- Expo push token for the device the user last signed in on, plus the
-- extensions the scheduled notification job needs.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
