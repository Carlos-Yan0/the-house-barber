-- Safety gate: block migration if existing rows violate the new rules
-- (only relevant if columns already exist due to manual drift).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_name = 'barber_schedules'
      AND c.column_name IN ('lunch_start_time', 'lunch_end_time')
    GROUP BY c.table_name
    HAVING COUNT(*) = 2
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM "barber_schedules" bs
      WHERE (bs."lunch_start_time" IS NOT NULL AND bs."lunch_start_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
         OR (bs."lunch_end_time" IS NOT NULL AND bs."lunch_end_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
         OR (
           bs."lunch_start_time" IS NOT NULL
           AND bs."lunch_end_time" IS NOT NULL
           AND bs."lunch_start_time"::time >= bs."lunch_end_time"::time
         )
    ) THEN
      RAISE EXCEPTION
        'Cannot apply barber_schedules lunch-break checks: invalid lunch rows already exist';
    END IF;
  END IF;
END $$;

ALTER TABLE "barber_schedules"
ADD COLUMN "lunch_start_time" TEXT;

ALTER TABLE "barber_schedules"
ADD COLUMN "lunch_end_time" TEXT;

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_lunch_start_time_format_chk"
CHECK ("lunch_start_time" IS NULL OR "lunch_start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_lunch_end_time_format_chk"
CHECK ("lunch_end_time" IS NULL OR "lunch_end_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_lunch_start_before_end_chk"
CHECK (
  ("lunch_start_time" IS NULL OR "lunch_end_time" IS NULL)
  OR ("lunch_start_time"::time < "lunch_end_time"::time)
);

