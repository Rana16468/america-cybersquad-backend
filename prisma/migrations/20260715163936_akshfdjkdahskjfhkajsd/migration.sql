-- CreateEnum
CREATE TYPE "ScholarshipsStatus" AS ENUM ('Active', 'Pending', 'InActive');

-- CreateTable
CREATE TABLE "scholarships_management" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "scholarshipsStatus" "ScholarshipsStatus" NOT NULL DEFAULT 'InActive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarships_management_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scholarships_management_studentId_idx" ON "scholarships_management"("studentId");

-- CreateIndex
CREATE INDEX "scholarships_management_subscriptionId_idx" ON "scholarships_management"("subscriptionId");

-- AddForeignKey
ALTER TABLE "scholarships_management" ADD CONSTRAINT "scholarships_management_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarships_management" ADD CONSTRAINT "scholarships_management_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
