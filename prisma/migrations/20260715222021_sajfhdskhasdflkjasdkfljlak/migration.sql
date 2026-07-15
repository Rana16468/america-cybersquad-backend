-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Transport', 'Extracurricular', 'Meal', 'Daycare', 'Other');

-- CreateEnum
CREATE TYPE "OptionalFeesStatus" AS ENUM ('Active', 'InActive');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('OneTime', 'Monthly', 'Quarterly', 'Annually');

-- CreateTable
CREATE TABLE "optional_fees" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "feesName" TEXT NOT NULL,
    "category" "Category" NOT NULL DEFAULT 'Other',
    "status" "OptionalFeesStatus" NOT NULL DEFAULT 'InActive',
    "frequency" "Frequency" NOT NULL,
    "description" TEXT,
    "additionalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "optional_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "optional_fees_studentId_idx" ON "optional_fees"("studentId");

-- CreateIndex
CREATE INDEX "optional_fees_subscriptionId_idx" ON "optional_fees"("subscriptionId");

-- AddForeignKey
ALTER TABLE "optional_fees" ADD CONSTRAINT "optional_fees_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_fees" ADD CONSTRAINT "optional_fees_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
