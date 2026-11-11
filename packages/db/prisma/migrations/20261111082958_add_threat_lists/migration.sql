-- CreateTable
CREATE TABLE `ThreatListEntry` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `source` ENUM('OFAC', 'METAMASK', 'PHISHDESTROY') NOT NULL,
    `kind` ENUM('WALLET', 'TX_HASH', 'DOMAIN', 'TELEGRAM', 'WHATSAPP', 'PHONE', 'EMAIL', 'APP', 'OTHER') NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `chain` VARCHAR(16) NULL,

    INDEX `ThreatListEntry_kind_value_idx`(`kind`, `value`),
    UNIQUE INDEX `ThreatListEntry_source_kind_value_key`(`source`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreatListAllow` (
    `value` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`value`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreatListSync` (
    `source` ENUM('OFAC', 'METAMASK', 'PHISHDESTROY') NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL,
    `entries` INTEGER NOT NULL,
    `ok` BOOLEAN NOT NULL,
    `error` VARCHAR(500) NULL,

    PRIMARY KEY (`source`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
