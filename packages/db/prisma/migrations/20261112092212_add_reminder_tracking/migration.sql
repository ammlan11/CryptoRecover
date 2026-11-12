-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `lastReminderAt` DATETIME(3) NULL,
    ADD COLUMN `remindersSent` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Report` ADD COLUMN `lastReminderAt` DATETIME(3) NULL,
    ADD COLUMN `remindersSent` INTEGER NOT NULL DEFAULT 0;
