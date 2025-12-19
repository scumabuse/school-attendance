/*
  Warnings:

  - You are about to drop the column `qualificationId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the `_CuratorGroups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CuratorGroups" DROP CONSTRAINT "_CuratorGroups_A_fkey";

-- DropForeignKey
ALTER TABLE "_CuratorGroups" DROP CONSTRAINT "_CuratorGroups_B_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_qualificationId_fkey";

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "qualificationId",
ADD COLUMN     "curatorId" UUID;

-- DropTable
DROP TABLE "_CuratorGroups";

-- CreateIndex
CREATE INDEX "groups_curatorId_idx" ON "groups"("curatorId");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
