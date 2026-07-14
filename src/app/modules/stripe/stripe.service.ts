import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import config from "../../../config";
import prisma from "../../../shared/prisma";
import stripe from "../../../helpars/stripe";
import { ISubscriptions } from "../subscription/subscription.interface";
import subscriptionServices from "../subscription/subscription.services";
import {
  deleteCache,
  getCache,
  setCache,
  setCacheIfNotExists,
} from "../../../config/redis";
import { logger } from "../../../config/logger";

const CHECKOUT_CACHE_TTL_SECONDS = 60 * 60 * 24;
const WEBHOOK_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7;

const getCheckoutCacheKey = (sessionId: string) =>
  `stripe_checkout_payload:${sessionId}`;

const getProcessedWebhookKey = (sessionId: string) =>
  `stripe_webhook_processed:${sessionId}`;

const createCheckoutSessionIntoStripe = async (
  userId: string,
  payload: ISubscriptions
) => {
  if (!config.stripe.secretKey) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe secret key is not configured"
    );
  }

  if (!config.stripe.checkout_success_url || !config.stripe.checkout_cancel_url) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe checkout URLs are not configured"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const amountInCents = Math.round(Number(payload.price) * 100);

  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid subscription price");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${config.stripe.checkout_success_url}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.stripe.checkout_cancel_url,
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      branchCount: String(payload.subscriptiondetails.length),
      totalPrice: String(payload.price),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountInCents,
          product_data: {
            name: "Scholarstika Annual Subscription",
            description: `${payload.subscriptiondetails.length} school branch subscription`,
          },
        },
      },
    ],
  });

  await setCache(
    getCheckoutCacheKey(session.id),
    {
      userId,
      payload,
    },
    CHECKOUT_CACHE_TTL_SECONDS
  );

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
};

const handleStripeWebhookEvent = async (
  signature: string | string[] | undefined,
  rawBody: Buffer | undefined
) => {
  if (!config.stripe.webhookSecret) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe webhook secret is not configured"
    );
  }

  if (!signature) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Missing Stripe signature");
  }

  if (!rawBody) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Missing Stripe raw body");
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret
  );

  if (event.type !== "checkout.session.completed") {
    return {
      received: true,
      ignored: true,
      eventType: event.type,
    };
  }

  const session = event.data.object;

  if (!session.id || session.payment_status !== "paid") {
    return {
      received: true,
      ignored: true,
      eventType: event.type,
    };
  }

  const processedKey = getProcessedWebhookKey(session.id);
  const wasMarkedNow = await setCacheIfNotExists(
    processedKey,
    "1",
    WEBHOOK_DEDUP_TTL_SECONDS
  );

  if (!wasMarkedNow) {
    logger.info({ sessionId: session.id }, "Stripe webhook already processed");
    return {
      received: true,
      duplicate: true,
      eventType: event.type,
    };
  }

  const cachedPayload = await getCache(getCheckoutCacheKey(session.id));

  if (!cachedPayload) {
    await deleteCache(processedKey);
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Checkout payload not found for completed Stripe session"
    );
  }

  const parsedPayload = cachedPayload as {
    userId: string;
    payload: ISubscriptions;
  };

  const result = await subscriptionServices.saveStripeSubscriptionIntoDb(
    parsedPayload.userId,
    parsedPayload.payload
  );

  if (!result.status) {
    await deleteCache(processedKey);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      result.message || "Failed to save subscription after Stripe payment"
    );
  }

  await deleteCache(getCheckoutCacheKey(session.id));

  logger.info(
    {
      sessionId: session.id,
      userId: parsedPayload.userId,
    },
    "Stripe payment completed and subscription saved"
  );

  return {
    received: true,
    processed: true,
    eventType: event.type,
  };
};

const stripeService = {
  createCheckoutSessionIntoStripe,
  handleStripeWebhookEvent,
};

export default stripeService;
