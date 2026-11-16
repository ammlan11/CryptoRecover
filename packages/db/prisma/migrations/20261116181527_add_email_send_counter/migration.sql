-- CreateTable
CREATE TABLE `EmailSend` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(40) NOT NULL,
    `ok` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailSend_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
