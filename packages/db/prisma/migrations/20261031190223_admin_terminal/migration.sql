-- AlterTable
ALTER TABLE `Staff` ADD COLUMN `activatedAt` DATETIME(3) NULL,
    ADD COLUMN `totpLastStep` INTEGER NULL;

-- CreateTable
CREATE TABLE `StaffInvite` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StaffInvite_tokenHash_key`(`tokenHash`),
    INDEX `StaffInvite_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StaffInvite` ADD CONSTRAINT `StaffInvite_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
