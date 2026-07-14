-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isPaymentSuccessFull" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentCount" DOUBLE PRECISION NOT NULL DEFAULT 0.00;
