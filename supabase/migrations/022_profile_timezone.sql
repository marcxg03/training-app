-- App timezone setting: the app's "what day is it" clock. Server components
-- run in UTC on Vercel, so without an explicit timezone every date decision
-- (today's workout, meal filing, chart bucketing) rolls to tomorrow at 7pm
-- Central. Stored per-profile, editable in Settings.

ALTER TABLE profiles
ADD COLUMN timezone text NOT NULL DEFAULT 'America/Chicago';
