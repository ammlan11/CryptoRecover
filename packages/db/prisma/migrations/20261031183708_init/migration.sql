-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `emailHash` CHAR(64) NOT NULL,
    `emailEnc` TEXT NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `totpSecretEnc` TEXT NULL,
    `totpEnabledAt` DATETIME(3) NULL,
    `totpLastStep` INTEGER NULL,
    `nameEnc` TEXT NULL,
    `country` CHAR(2) NULL,
    `locale` VARCHAR(10) NOT NULL DEFAULT 'en',
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_emailHash_key`(`emailHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRecoveryCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` CHAR(64) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserRecoveryCode_userId_codeHash_key`(`userId`, `codeHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LoginChallenge_tokenHash_key`(`tokenHash`),
    INDEX `LoginChallenge_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipHash` CHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserSession_tokenHash_key`(`tokenHash`),
    INDEX `UserSession_userId_idx`(`userId`),
    INDEX `UserSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `emailHash` CHAR(64) NOT NULL,
    `purpose` ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'CONTINUE_REPORT') NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailToken_emailHash_idx`(`emailHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `publicRef` VARCHAR(12) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'RECEIVED', 'IN_HOUSE_REVIEW', 'INFO_NEEDED', 'WITH_INVESTIGATORS', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `scamType` ENUM('PIG_BUTCHERING', 'FAKE_TRADING_APP', 'MESSAGING_BROKER', 'RECOVERY_OFFER', 'WALLET_DRAINER', 'IMPERSONATION', 'OTHER', 'UNSURE') NOT NULL,
    `scamPattern` VARCHAR(80) NULL,
    `contactChannel` ENUM('TELEGRAM', 'WHATSAPP', 'SOCIAL_MEDIA', 'DATING_APP', 'PHONE', 'EMAIL', 'WEBSITE_AD', 'OTHER') NULL,
    `country` CHAR(2) NULL,
    `lossBand` ENUM('NONE', 'UNDER_1K', 'FROM_1K_TO_10K', 'FROM_10K_TO_50K', 'OVER_50K') NULL,
    `occurredAt` DATETIME(3) NULL,
    `narrativeEnc` MEDIUMTEXT NULL,
    `lastStep` INTEGER NOT NULL DEFAULT 1,
    `assignedStaffId` VARCHAR(191) NULL,
    `researchConsentAt` DATETIME(3) NULL,
    `publicAlertConsentAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Report_publicRef_key`(`publicRef`),
    INDEX `Report_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Report_scamType_idx`(`scamType`),
    INDEX `Report_assignedStaffId_idx`(`assignedStaffId`),
    INDEX `Report_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportPayment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(28, 8) NULL,
    `asset` VARCHAR(16) NOT NULL,
    `network` VARCHAR(32) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportPayment_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportIndicator` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `kind` ENUM('WALLET', 'TX_HASH', 'DOMAIN', 'TELEGRAM', 'WHATSAPP', 'PHONE', 'EMAIL', 'APP', 'OTHER') NOT NULL,
    `value` VARCHAR(512) NOT NULL,
    `normalizedValue` VARCHAR(512) NOT NULL,
    `chain` VARCHAR(32) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedById` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportIndicator_kind_normalizedValue_idx`(`kind`, `normalizedValue`(191)),
    INDEX `ReportIndicator_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndicatorWatch` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('WALLET', 'TX_HASH', 'DOMAIN', 'TELEGRAM', 'WHATSAPP', 'PHONE', 'EMAIL', 'APP', 'OTHER') NOT NULL,
    `normalizedValue` VARCHAR(512) NOT NULL,
    `emailHash` CHAR(64) NOT NULL,
    `emailEnc` TEXT NOT NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unsubscribedAt` DATETIME(3) NULL,

    INDEX `IndicatorWatch_kind_normalizedValue_idx`(`kind`, `normalizedValue`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidence` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `fileNameEnc` TEXT NOT NULL,
    `scanStatus` ENUM('PENDING', 'CLEAN', 'INFECTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Evidence_storageKey_key`(`storageKey`),
    INDEX `Evidence_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `authorType` ENUM('USER', 'STAFF') NOT NULL,
    `staffId` VARCHAR(191) NULL,
    `bodyEnc` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_reportId_createdAt_idx`(`reportId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternalNote` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `bodyEnc` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InternalNote_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issue` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `category` ENUM('SITE_PROBLEM', 'COMPLAINT', 'DATA_REQUEST', 'OTHER') NOT NULL,
    `bodyEnc` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Issue_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `source` ENUM('HERO_FORM', 'CAMPAIGN_FORM', 'CHECKER_WATCH', 'NEWSLETTER') NOT NULL,
    `emailHash` CHAR(64) NOT NULL,
    `emailEnc` TEXT NOT NULL,
    `scamType` ENUM('PIG_BUTCHERING', 'FAKE_TRADING_APP', 'MESSAGING_BROKER', 'RECOVERY_OFFER', 'WALLET_DRAINER', 'IMPERSONATION', 'OTHER', 'UNSURE') NULL,
    `lossBand` ENUM('NONE', 'UNDER_1K', 'FROM_1K_TO_10K', 'FROM_10K_TO_50K', 'OVER_50K') NULL,
    `country` CHAR(2) NULL,
    `landingPage` VARCHAR(255) NULL,
    `utmSource` VARCHAR(100) NULL,
    `utmMedium` VARCHAR(100) NULL,
    `utmCampaign` VARCHAR(150) NULL,
    `utmContent` VARCHAR(150) NULL,
    `utmTerm` VARCHAR(150) NULL,
    `gclid` VARCHAR(255) NULL,
    `fbclid` VARCHAR(255) NULL,
    `marketingConsent` BOOLEAN NOT NULL DEFAULT false,
    `convertedReportId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Lead_convertedReportId_key`(`convertedReportId`),
    INDEX `Lead_source_createdAt_idx`(`source`, `createdAt`),
    INDEX `Lead_emailHash_idx`(`emailHash`),
    INDEX `Lead_utmCampaign_idx`(`utmCampaign`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'REVIEWER', 'INVESTIGATOR', 'VIEWER') NOT NULL,
    `organisation` VARCHAR(120) NULL,
    `totpSecretEnc` TEXT NULL,
    `allowedIps` TEXT NULL,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `disabledAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Staff_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebAuthnKey` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(512) NOT NULL,
    `publicKey` LONGBLOB NOT NULL,
    `counter` BIGINT NOT NULL DEFAULT 0,
    `label` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WebAuthnKey_credentialId_key`(`credentialId`),
    INDEX `WebAuthnKey_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffSession` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `secondFactorAt` DATETIME(3) NULL,
    `reauthenticatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffSession_tokenHash_key`(`tokenHash`),
    INDEX `StaffSession_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorType` VARCHAR(16) NOT NULL,
    `actorId` VARCHAR(64) NULL,
    `action` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `ip` VARCHAR(45) NULL,
    `detail` JSON NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `prevHash` CHAR(64) NULL,
    `hash` CHAR(64) NOT NULL,

    UNIQUE INDEX `AuditLog_hash_key`(`hash`),
    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_actorType_actorId_idx`(`actorType`, `actorId`),
    INDEX `AuditLog_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRecoveryCode` ADD CONSTRAINT `UserRecoveryCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoginChallenge` ADD CONSTRAINT `LoginChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportPayment` ADD CONSTRAINT `ReportPayment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportIndicator` ADD CONSTRAINT `ReportIndicator_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportIndicator` ADD CONSTRAINT `ReportIndicator_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportIndicator` ADD CONSTRAINT `ReportIndicator_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `ReportPayment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicatorWatch` ADD CONSTRAINT `IndicatorWatch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalNote` ADD CONSTRAINT `InternalNote_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalNote` ADD CONSTRAINT `InternalNote_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_convertedReportId_fkey` FOREIGN KEY (`convertedReportId`) REFERENCES `Report`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebAuthnKey` ADD CONSTRAINT `WebAuthnKey_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffSession` ADD CONSTRAINT `StaffSession_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
