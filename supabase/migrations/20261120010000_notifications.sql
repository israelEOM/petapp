-- Server-side notifications for shared pets (phase 6).
-- - notify-activity: when someone logs, the other members get "Ana deu comida para o Thor".
-- - due-reminders (every 15 min): meal and "fechar o dia" reminders go to whoever is on duty, and
--   only if nobody has logged it yet. Phones stop scheduling those locally once the pet is shared.
-- Both edge functions run with the service role; neither trusts its request body beyond an id.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Per-person switch for "someone in the family logged something" pushes.
alter table public.profiles add column if not exists notify_family boolean not null default true;

-- Each member's own reminder settings for a shared pet (times are local to `tz`).
create table public.reminder_prefs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  enabled boolean not null default false,
  meal_times text[] not null default '{}',   -- "HH:MM", one per meal
  streak boolean not null default true,
  tz text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now(),
  primary key (user_id, pet_id),
  check (array_length(meal_times, 1) is null or array_length(meal_times, 1) <= 4)
);
create trigger reminder_prefs_touch before update on public.reminder_prefs
  for each row execute function public.touch_updated_at();
alter table public.reminder_prefs enable row level security;
create policy "reminder prefs: own" on public.reminder_prefs for all to authenticated
  using (user_id = auth.uid() and public.is_pet_member(pet_id))
  with check (user_id = auth.uid() and public.is_pet_member(pet_id));

-- Every push sent, so retries and overlapping cron runs never send the same one twice.
create table public.notification_log (
  key text primary key,                      -- e.g. 'activity:<id>:<user>' or 'meal:<pet>:<user>:<day>:<n>'
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.notification_log enable row level security;  -- no policies: service role only

-- Calls the notify-activity function for each new activity (async, via pg_net).
create function public.notify_activity_hook() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://yucybgxdbkbukulouxes.supabase.co/functions/v1/notify-activity',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
exception when others then
  return new;  -- a notification problem must never block logging
end;
$$;
create trigger activities_notify after insert on public.activities
  for each row execute function public.notify_activity_hook();

-- Reminders every 15 minutes.
select cron.schedule(
  'petapp-due-reminders',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://yucybgxdbkbukulouxes.supabase.co/functions/v1/due-reminders',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  $cron$
);

-- Clean up the send log after two weeks.
select cron.schedule(
  'petapp-notification-log-cleanup',
  '17 4 * * *',
  $cron$ delete from public.notification_log where sent_at < now() - interval '14 days'; $cron$
);
