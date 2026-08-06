-- Skill level is no longer part of a profile: how good someone says they are
-- wasn't earning its place in the UI. A game's difficulty (games.difficulty)
-- is unaffected.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS skill_level;
