-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('CUSTOMER', 'PROFESSIONAL', 'ADMIN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `bio` TEXT NULL,
    `serviceMode` ENUM('HOME', 'STORE', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `storeAddress` VARCHAR(191) NULL,
    `travelFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `verificationStatus` ENUM('UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'UNSUBMITTED',
    `rejectionReason` VARCHAR(191) NULL,
    `idImagePath` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `ratingAvg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `professional_profiles_userId_key`(`userId`),
    INDEX `professional_profiles_verificationStatus_idx`(`verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_categories` (
    `professionalId` INTEGER NOT NULL,
    `category` ENUM('HAIR', 'NAILS', 'MAKEUP') NOT NULL,

    INDEX `professional_categories_category_idx`(`category`),
    PRIMARY KEY (`professionalId`, `category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_areas` (
    `professionalId` INTEGER NOT NULL,
    `area` VARCHAR(80) NOT NULL,

    INDEX `professional_areas_area_idx`(`area`),
    PRIMARY KEY (`professionalId`, `area`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('HAIR', 'NAILS', 'MAKEUP') NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `durationMin` INTEGER NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `services_professionalId_isActive_idx`(`professionalId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portfolio_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `portfolio_images_professionalId_idx`(`professionalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `availability_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMin` INTEGER NOT NULL,
    `endMin` INTEGER NOT NULL,

    INDEX `availability_rules_professionalId_dayOfWeek_idx`(`professionalId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocked_dates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `reason` VARCHAR(191) NULL,

    UNIQUE INDEX `blocked_dates_professionalId_date_key`(`professionalId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `mode` ENUM('HOME', 'STORE') NOT NULL,
    `address` TEXT NULL,
    `area` VARCHAR(80) NULL,
    `occasion` ENUM('WEDDING', 'GRADUATION', 'DEBUT', 'BIRTHDAY', 'PHOTOSHOOT', 'OTHER') NULL,
    `notes` TEXT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING_DEPOSIT',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `travelFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `depositPct` DECIMAL(5, 2) NOT NULL,
    `depositAmount` DECIMAL(10, 2) NOT NULL,
    `balanceDue` DECIMAL(10, 2) NOT NULL,
    `commissionPct` DECIMAL(5, 2) NOT NULL,
    `gcashRef` VARCHAR(64) NULL,
    `depositScreenshotPath` VARCHAR(191) NULL,
    `depositSubmittedAt` DATETIME(3) NULL,
    `depositVerifiedAt` DATETIME(3) NULL,
    `depositVerifiedById` INTEGER NULL,
    `depositRejectNote` VARCHAR(191) NULL,
    `holdExpiresAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` INTEGER NULL,
    `refundNeeded` BOOLEAN NOT NULL DEFAULT false,
    `refundResolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bookings_professionalId_startAt_idx`(`professionalId`, `startAt`),
    INDEX `bookings_customerId_status_idx`(`customerId`, `status`),
    INDEX `bookings_status_idx`(`status`),
    INDEX `bookings_refundNeeded_idx`(`refundNeeded`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `serviceId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('HAIR', 'NAILS', 'MAKEUP') NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `durationMin` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `booking_items_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_earnings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `gross` DECIMAL(10, 2) NOT NULL,
    `commissionPct` DECIMAL(5, 2) NOT NULL,
    `commissionAmount` DECIMAL(10, 2) NOT NULL,
    `travelFee` DECIMAL(10, 2) NOT NULL,
    `proNet` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `booking_earnings_bookingId_key`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reviews_bookingId_key`(`bookingId`),
    INDEX `reviews_professionalId_createdAt_idx`(`professionalId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('BOOKING_REQUESTED', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'DEPOSIT_REJECTED', 'BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'BOOKING_NO_SHOW', 'REMINDER_DAY_BEFORE', 'REVIEW_REQUEST', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'REFUND_NEEDED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `bookingId` INTEGER NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notifications_dedupeKey_key`(`dedupeKey`),
    INDEX `notifications_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `notifications_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `depositPct` DECIMAL(5, 2) NOT NULL DEFAULT 20,
    `commissionPct` DECIMAL(5, 2) NOT NULL DEFAULT 10,
    `holdMinutes` INTEGER NOT NULL DEFAULT 120,
    `gcashNumber` VARCHAR(191) NOT NULL DEFAULT '09XX XXX XXXX',
    `gcashName` VARCHAR(191) NOT NULL DEFAULT 'Gara (placeholder)',
    `gcashQrPath` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `professional_profiles` ADD CONSTRAINT `professional_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_categories` ADD CONSTRAINT `professional_categories_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_areas` ADD CONSTRAINT `professional_areas_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portfolio_images` ADD CONSTRAINT `portfolio_images_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `availability_rules` ADD CONSTRAINT `availability_rules_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocked_dates` ADD CONSTRAINT `blocked_dates_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_depositVerifiedById_fkey` FOREIGN KEY (`depositVerifiedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_earnings` ADD CONSTRAINT `booking_earnings_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professional_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
