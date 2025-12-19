-- This migration represents changes that were already applied manually to the database
-- Adding attendance columns to groups and students

ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "attendance" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "attendance" DOUBLE PRECISION DEFAULT 0;