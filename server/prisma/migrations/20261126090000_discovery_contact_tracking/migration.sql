-- AlterTable
ALTER TABLE `professional_profiles` ADD COLUMN `availabilityUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `contactPhone` VARCHAR(30) NULL,
    ADD COLUMN `messengerUrl` VARCHAR(200) NULL;

-- CreateTable
CREATE TABLE `contact_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `channel` ENUM('MESSENGER', 'CALL', 'SMS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contact_events_professionalId_createdAt_idx`(`professionalId`, `createdAt`),
    INDEX `contact_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `viewerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `profile_views_professionalId_createdAt_idx`(`professionalId`, `createdAt`),
    INDEX `profile_views_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `category` ENUM('HAIR', 'NAILS', 'MAKEUP') NULL,
    `area` VARCHAR(80) NULL,
    `hasDate` BOOLEAN NOT NULL DEFAULT false,
    `resultCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contact_events` ADD CONSTRAINT `contact_events_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_events` ADD CONSTRAINT `contact_events_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

