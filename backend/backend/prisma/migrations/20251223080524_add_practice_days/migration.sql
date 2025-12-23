/*
  Warnings:

  - You are about to drop the column `attendance` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `attendance` on the `students` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'DUAL';
ALTER TYPE "AttendanceStatus" ADD VALUE 'LATE';

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "attendance";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "attendance";

-- CreateTable
CREATE TABLE "PracticeDay" (
    "id" TEXT NOT NULL,
    "groupId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,

    CONSTRAINT "PracticeDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeDay_groupId_date_key" ON "PracticeDay"("groupId", "date");

-- AddForeignKey
ALTER TABLE "PracticeDay" ADD CONSTRAINT "PracticeDay_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
