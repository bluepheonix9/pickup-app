-- Fan out push notifications by calling Edge Functions over pg_net: two row
-- triggers for the immediate events, and an hourly cron job for the reminders.
-- Function sources live in supabase/functions/notify-*.

CREATE OR REPLACE FUNCTION trigger_notify_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lgtqgcryodmbneykcwxz.supabase.co/functions/v1/notify-join',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object('record', row_to_json(NEW))::text::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_member_insert
AFTER INSERT ON public.game_members
FOR EACH ROW EXECUTE FUNCTION trigger_notify_join();

CREATE OR REPLACE FUNCTION trigger_notify_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lgtqgcryodmbneykcwxz.supabase.co/functions/v1/notify-chat',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object('record', row_to_json(NEW))::text::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION trigger_notify_chat();

-- Reminder sweep: the function itself picks out games ~24h and ~1h away.
SELECT cron.schedule(
  'notify-upcoming-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lgtqgcryodmbneykcwxz.supabase.co/functions/v1/notify-upcoming',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
