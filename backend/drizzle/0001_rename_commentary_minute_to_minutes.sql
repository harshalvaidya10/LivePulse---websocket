DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commentary'
      AND column_name = 'minute'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commentary'
      AND column_name = 'minutes'
  ) THEN
    ALTER TABLE "commentary" RENAME COLUMN "minute" TO "minutes";
  END IF;
END
$$;
