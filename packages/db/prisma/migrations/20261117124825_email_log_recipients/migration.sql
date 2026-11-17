-- AlterTable
ALTER TABLE `EmailSend` ADD COLUMN `subject` VARCHAR(200) NULL,
    ADD COLUMN `toEnc` TEXT NULL,
    ADD COLUMN `toHash` CHAR(64) NULL;

-- CreateIndex
CREATE INDEX `EmailSend_toHash_idx` ON `EmailSend`(`toHash`);
