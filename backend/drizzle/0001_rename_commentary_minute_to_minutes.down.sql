DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commentary'
      AND column_name = 'minutes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commentary'
      AND column_name = 'minute'
  ) THEN
    ALTER TABLE "commentary" RENAME COLUMN "minutes" TO "minute";
  END IF;
END
$$;
