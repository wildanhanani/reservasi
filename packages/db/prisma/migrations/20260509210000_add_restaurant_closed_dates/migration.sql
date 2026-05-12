-- Store date-specific restaurant holidays/libur as YYYY-MM-DD values.
ALTER TABLE "Restaurant" ADD COLUMN "closedDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
