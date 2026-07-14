import { logger } from "../config/logger";
import catchError from "../errors/catchError";
import prisma from "../shared/prisma";

const hardDeleteSubscriptionByIdIntoDb = async (subscriptionId: string) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionDetails.deleteMany({
        where: { subscriptionId },
      });

      await tx.institutionBranch.deleteMany({
        where: { subscriptionId },
      });

      await tx.subscriptions.delete({
        where: { id: subscriptionId },
      });
    });

    return {
      status: true,
      message: "Subscription deleted permanently",
    };
  } catch (error) {
    catchError(error);

    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete subscription",
    };
  }
};


const autoDeleteUnVerifiedPayment = async () => {
  try {
    // ফ্রী ট্রায়াল subscription এর মেয়াদ শেষ হয়ে গেলেও ডিলিট করার দরকার নাই।
    // শুধুমাত্র সেই subscription গুলো টার্গেট করা হচ্ছে যেখানে:
    //   i) subscriptiondetails এ "paid" type এর detail আছে (অর্থাৎ payment attempt/checkout হয়েছিল)
    //   ii) কিন্তু isPaymentSuccessFull এখনো false (payment status সফলভাবে confirm/complete হয়নি)
    // অর্থাৎ এগুলো আটকে থাকা (stuck) বা ব্যর্থ (failed/abandoned) পেমেন্ট রেকর্ড।
    const stuckPaidSubscriptions = await prisma.subscriptions.findMany({
      where: {
        isPaymentSuccessFull: false,
        subscriptiondetails: {
          some: {
            subscriptionType: "paid",
          },
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (stuckPaidSubscriptions.length === 0) {
      logger.info("No stuck/unverified paid subscriptions found");
      return {
        status: true,
        message: "No unverified subscriptions to delete",
        deletedCount: 0,
      };
    }

    let deletedCount = 0;
    const failedIds: string[] = [];

    // প্রতিটা stuck/unverified paid subscription এক এক করে hard delete করা হচ্ছে
    for (const subscription of stuckPaidSubscriptions) {
      const result = await hardDeleteSubscriptionByIdIntoDb(subscription.id);

      if (result.status) {
        deletedCount += 1;
        logger.info(
          { subscriptionId: subscription.id, userId: subscription.userId },
          "Auto-deleted stuck/unverified paid subscription"
        );
      } else {
        failedIds.push(subscription.id);
        logger.error(
          { subscriptionId: subscription.id, message: result.message },
          "Failed to auto-delete unverified subscription"
        );
      }
    }

    return {
      status: true,
      message: `Auto-delete completed. Deleted: ${deletedCount}, Failed: ${failedIds.length}`,
      deletedCount,
      failedIds,
    };
  } catch (error) {
    catchError(error);

    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to run auto-delete unverified payment job",
    };
  }
};

export default autoDeleteUnVerifiedPayment;