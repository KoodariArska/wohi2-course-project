/*
  Warnings:

  - Added the required column `correct` to the `attempts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attempts` ADD COLUMN `correct` BOOLEAN NOT NULL;
