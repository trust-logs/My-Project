-- ErrandGo: ratings start at zero until a user receives a real review.
-- Safe to run on a fresh or existing database.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='rating'
    ) THEN
      EXECUTE 'UPDATE public.profiles SET rating = 0 WHERE rating IS DISTINCT FROM 0';
      EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN rating SET DEFAULT 0';
    END IF;
  END IF;
END $$;
