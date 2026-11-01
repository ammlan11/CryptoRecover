-- AlterTable
ALTER TABLE `User` ADD COLUMN `phoneEnc` TEXT NULL,
    ADD COLUMN `phoneHash` CHAR(64) NULL,
    ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PhoneCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('VERIFY', 'LOGIN') NOT NULL,
    `phoneEnc` TEXT NOT NULL,
    `phoneHash` CHAR(64) NOT NULL,
    `codeHash` CHAR(64) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `ipHash` CHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhoneCode_userId_purpose_createdAt_idx`(`userId`, `purpose`, `createdAt`),
    INDEX `PhoneCode_phoneHash_createdAt_idx`(`phoneHash`, `createdAt`),
    INDEX `PhoneCode_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PhoneCode` ADD CONSTRAINT `PhoneCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
