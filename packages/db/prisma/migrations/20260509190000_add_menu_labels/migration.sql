-- Add admin-configurable labels/tags for menu items.
ALTER TABLE "MenuItem" ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
