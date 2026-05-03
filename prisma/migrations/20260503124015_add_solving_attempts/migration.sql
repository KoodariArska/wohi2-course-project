-- CreateTable
CREATE TABLE `attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAnswer` VARCHAR(255) NOT NULL,
    `userId` INTEGER NOT NULL,
    `qId` INTEGER NOT NULL,

    UNIQUE INDEX `attempts_userId_qId_key`(`userId`, `qId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_qId_fkey` FOREIGN KEY (`qId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
