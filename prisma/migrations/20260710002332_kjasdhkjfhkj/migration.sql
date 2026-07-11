/*
  Warnings:

  - You are about to drop the column `materialName` on the `class_materials` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "class_materials" DROP COLUMN "materialName",
ADD COLUMN     "assignmentTitle" TEXT;
