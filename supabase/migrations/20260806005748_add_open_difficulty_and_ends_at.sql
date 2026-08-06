-- Games can now be marked "open to all levels", so widen the difficulty check.
-- profiles.skill_level intentionally keeps the narrower beginner/intermediate/
-- advanced set: "open to all" describes a game, not a person.
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_difficulty_check;
ALTER TABLE public.games ADD CONSTRAINT games_difficulty_check
  CHECK (difficulty = ANY (ARRAY['open'::text, 'beginner'::text, 'intermediate'::text, 'advanced'::text]));

-- Optional end time, set from the date/time picker in the host form.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ends_at timestamptz;
