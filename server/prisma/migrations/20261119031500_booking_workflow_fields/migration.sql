-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `declineReason` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `bookings_gcashRef_key` ON `bookings`(`gcashRef`);

