import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { ISubscriptionDetails, ISubscriptions } from "./subscription.interface";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { nestedFields } from "./subscription.constant";
import { getCache, setCache } from "../../../config/redis";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import config from "../../../config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";



const saveUserSubscriptionIntoDb = async (
  userId: string,
  payload: ISubscriptions
) => {
  const { price, subscriptiondetails } = payload;

  // Check if the payload contains a free trial
  const hasFreeTrialInPayload = subscriptiondetails.some(
    (item) => item.subscriptionType === "free_trial"
  );
  const isAlreadyUsedFree = await prisma.subscriptions.findFirst({
    where: {
      userId,
      subscriptiondetails: {
        some: {
          subscriptionType: "free_trial",
        },
      },
    },
  });

  if (isAlreadyUsedFree && hasFreeTrialInPayload) {
    throw new ApiError(httpStatus.CONFLICT, "Free trial already used");
  }

  
  const detailsWithIds = subscriptiondetails.map((item) => ({
    id: randomUUID(),
    ...item,
  }));

  
  let validUntil: Date | null = null;

  if (hasFreeTrialInPayload) {
    validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // 7 days from now
  }

  // Create subscription
  const subscription = await prisma.subscriptions.create({
    data: {
      userId,
      price,
      validUntil,

      subscriptiondetails: {
        create: detailsWithIds.map((item) => ({
          id: item.id,
          subscriptionType: item.subscriptionType,
          schoolName: item.schoolName,
          country: item.country,
          state: item.state,
          city: item.city,
          area: item.area,
          schoolPhoto: item.schoolPhoto,
          schoolType: item.schoolType,
          studentLimit: item.studentLimit,
        })),
      },

      institutionBranches: {
        create: detailsWithIds.map((item) => ({
          userId,
          subscriptionDetailId: item.id,
          name: item.schoolName,
          type: item.schoolType,
          location: [item.city, item.state, item.country]
            .filter(Boolean)
            .join(", "),
        })),
      },
    },
    include: {
      subscriptiondetails: true,
      institutionBranches: true,
    },
  });

  return {
    status: true,
    message: "Successfully Recorded",
    data: subscription,
  };
};


const findByAllSubscriptionsAdminIntoDb = async (
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .filter()
      .sort()
      .paginate()
      .fields()
      .search(["price"]); 

    const queryOptions = queryBuilder.build();


    const detailsFilter: Record<string, any> = {};

    nestedFields.forEach((field) => {
      if (query[field]) {
        detailsFilter[field] = {
          contains: String(query[field]),
          mode: "insensitive",
        };
      }
    });

    // ✅ relation filter (safe merge)
    if (Object.keys(detailsFilter).length > 0) {
      queryOptions.where = {
        ...queryOptions.where,
        subscriptiondetails: {
          some: detailsFilter,
        },
      };
    }

    // ✅ main query
    const [subscriptions, total] = await Promise.all([
      prisma.subscriptions.findMany({
        where: queryOptions.where,
        include: {
          subscriptiondetails: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
              isVerified: true,
            },
          },
        },
        skip: queryOptions.skip,
        take: queryOptions.take,
        orderBy: queryOptions.orderBy,
      }),

      prisma.subscriptions.count({
        where: queryOptions.where,
      }),
    ]);

    // ✅ pagination
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: subscriptions,
    };
  } catch (error) {
    catchError(error);
  }
};

const hardDeleteSubscriptionByIdIntoDb = async (subscriptionId: string) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionDetails.deleteMany({
        where: {
          subscriptionId,
        },
      });

      await tx.institutionBranch.deleteMany({
        where: {
          subscriptionId,
        },
      });

      await tx.subscriptions.delete({
        where: {
          id: subscriptionId,
        },
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



const findMyAllSubscriptionsIntoDb = async (
  userId: string,
  query: Record<string, any>
) => {
  try {

    console.log('userId', userId)
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(["price"])
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const detailsFilter: Record<string, any> = {};

    const nestedFields = [
      "state",
      "city",
      "country",
      "area",
      "schoolName",
      "schoolType",
      "studentLimit",
    ];

    nestedFields.forEach((field) => {
      if (query[field]) {
        detailsFilter[field] = {
          contains: String(query[field]),
          mode: "insensitive",
        };
      }
    });

    
    const hasPaidSubscription = await prisma.subscriptions.findFirst({
      where: {
        userId,
        isDeleted: false,
        subscriptiondetails: {
          some: {
            isDeleted: false,
            subscriptionType: "paid",
          },
        },
      },
      select: {
        id: true,
      },
    });

    queryOptions.where = {
      ...queryOptions.where,
      userId,
      isDeleted: false,
      subscriptiondetails: {
        some: {
          isDeleted: false,
          ...(hasPaidSubscription
            ? {
                subscriptionType: "paid",
              }
            : {
                subscriptionType: "free_trial",
              }),
          ...detailsFilter,
        },
      },
    };

    const subscription = await prisma.subscriptions.findFirst({
      where: queryOptions.where,
      include: {
        subscriptiondetails: {
          where: {
            isDeleted: false,
            ...(hasPaidSubscription
              ? {
                  subscriptionType: "paid",
                }
              : {
                  subscriptionType: "free_trial",
                }),
          },
        },
      },
      orderBy: queryOptions.orderBy,
    });

    if (!subscription) {
      return null;
    }

    const currentSubscriptionToken = jwtHelpers.generateToken(
      {
        userId: subscription.userId,
        subscriptionId: subscription.id,
      },
      config.jwt_access_secret as string,
      config.expires_in as string
    );

    return {
      currentSubscriptionToken,
      ...subscription,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const findMyPaymentStatusIntoDb = async (userId: string) => {
  try {
    const latestSubscription = await prisma.subscriptions.findFirst({
      where: {
        userId,
        isDeleted: false,
      },
      include: {
        subscriptiondetails: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalSubscriptions = await prisma.subscriptions.count({
      where: {
        userId,
        isDeleted: false,
      },
    });

    const hasPaidSubscription = Boolean(latestSubscription);

    return {
      isPaid: hasPaidSubscription,
      status: hasPaidSubscription ? "paid" : "unpaid",
      totalSubscriptions,
      latestSubscription: latestSubscription
        ? {
            id: latestSubscription.id,
            price: latestSubscription.price,
            createdAt: latestSubscription.createdAt,
            updatedAt: latestSubscription.updatedAt,
            branchesCount: latestSubscription.subscriptiondetails.length,
            schools: latestSubscription.subscriptiondetails.map((item) => ({
              id: item.id,
              schoolName: item.schoolName,
              country: item.country,
              state: item.state,
              city: item.city,
              area: item.area,
              schoolType: item.schoolType,
              studentLimit: item.studentLimit,
              subscriptionType: item.subscriptionType,
            })),
          }
        : null,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const allCountryListIntoDb = async (
  query: Record<string, any>
) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `all_country_list_${page}_${limit}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const totalCountries = await prisma.subscriptionDetails.groupBy({
      by: ["country"],
    });

    const result = await prisma.subscriptionDetails.groupBy({
      by: ["country"],
      _count: {
        country: true,
      },
      orderBy: {
        _count: {
          country: "desc",
        },
      },
      skip,
      take: limit,
    });

    const data = result.map((item) => ({
      country: item.country,
      count: item._count.country,
    }));

    const response = {
      meta: {
        page,
        limit,
        total: totalCountries.length,
        totalPage: Math.ceil(totalCountries.length / limit),
      },
      data,
    };

  
    await setCache(cacheKey, response, 60 * 60);

    return response;
  } catch (error) {
    throw catchError(error);
  }
};

const allSchoolListIntoDb = async (
  query: Record<string, any>
) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionDetailsWhereInput = {};

    const [result, total] = await Promise.all([
      prisma.subscriptionDetails.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          schoolName: true,
          schoolType: true,
          country: true,
          area: true,
          city: true,
          schoolPhoto: true,
        },
      }),

      prisma.subscriptionDetails.count({
        where,
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
      data: result,
    };
  } catch (error) {
    throw catchError(error);
  }
};


const STRIPE_SUBSCRIPTION_EXTENSION_MONTHS = 3;
 
const addSubscriptionMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};
 
type ExistingSubscription = {
  id: string;
  userId: string;
  price: number;
  validUntil: Date | null;
};
 
const saveStripeSubscriptionIntoDb = async (
  userId: string,
  payload: ISubscriptions
) => {
  try {
    const { price, subscriptiondetails } = payload;
    const now = new Date();
    const branchCount = subscriptiondetails.length || 1;
    const pricePerBranch = price / branchCount;
 
    return await prisma.$transaction(async (tx) => {
     
      const existingSubscriptionRaw =
        await tx.$queryRaw<ExistingSubscription[]>(Prisma.sql`
          SELECT
            id,
            "userId",
            price,
            "validUntil"
          FROM "subscriptions"
          WHERE "userId" = ${userId}
            AND "isDeleted" = false
          ORDER BY "createdAt" DESC
          LIMIT 1
          FOR UPDATE
        `);
 
      const existingSubscription = existingSubscriptionRaw[0];
 
      /**
       * ============================================================
       * CASE 1
       * User already has a subscription (Free Trial or Paid)
       * ============================================================
       */
      if (existingSubscription) {
        const existingDetails = await tx.subscriptionDetails.findMany({
          where: {
            subscriptionId: existingSubscription.id,
            isDeleted: false,
          },
        });
 
        const hasFreeTrial = existingDetails.some(
          (item) => item.subscriptionType === "free_trial"
        );
 
        const baseDate = hasFreeTrial
          ? now
          : existingSubscription.validUntil &&
            existingSubscription.validUntil > now
          ? existingSubscription.validUntil
          : now;
 
        const updatedSubscription = await tx.subscriptions.update({
          where: { id: existingSubscription.id },
          data: {
            price: existingSubscription.price + price,
            validUntil: addSubscriptionMonths(
              baseDate,
              STRIPE_SUBSCRIPTION_EXTENSION_MONTHS
            ),
            // Payment success hoile paymentCount 1 barbe ebong flag true hobe
            paymentCount: {
              increment: 1,
            },
            isPaymentSuccessFull: true,
            ...(hasFreeTrial && {
              subscriptiondetails: {
                updateMany: {
                  where: {
                    subscriptionId: existingSubscription.id,
                    subscriptionType: "free_trial",
                  },
                  data: { subscriptionType: "paid" },
                },
              },
            }),
          },
        });
 
     
        if (hasFreeTrial) {
          await tx.institutionBranch.updateMany({
            where: {
              subscriptionId: existingSubscription.id,
              isDeleted: false,
            },
            data: {
              annualPriceUsd: pricePerBranch,
            },
          });
        }
 
        // ---------- Tin table distribution: নতুন কেনা branch গুলোর জন্য SubscriptionDetails + InstitutionBranch ----------
        for (const item of subscriptiondetails) {
          const createdDetail = await tx.subscriptionDetails.create({
            data: {
              subscriptionId: existingSubscription.id,
              subscriptionType: "paid",
              schoolName: item.schoolName,
              country: item.country,
              state: item.state,
              city: item.city,
              area: item.area,
              schoolType: item.schoolType,
              studentLimit: item.studentLimit,
            },
          });
 
          await tx.institutionBranch.create({
            data: {
              userId,
              subscriptionId: existingSubscription.id,
              subscriptionDetailId: createdDetail.id,
              name: item.schoolName,
              type: item.schoolType,
              location: `${item.city}, ${item.state ?? ""}, ${item.country}`,
              annualPriceUsd: pricePerBranch,
            },
          });
        }
 
        const finalSubscription = await tx.subscriptions.findUnique({
          where: { id: existingSubscription.id },
          include: {
            subscriptiondetails: true,
            institutionBranches: true,
          },
        });
 
        return {
          status: true,
          message: hasFreeTrial
            ? "Free trial converted to paid subscription successfully."
            : "Subscription extended successfully.",
          data: finalSubscription,
        };
      }
 
      /**
       * ============================================================
       * CASE 2
       * No subscription exists
       * Create brand new Paid Subscription + Details + Branches
       * ============================================================
       */
      const createdSubscription = await tx.subscriptions.create({
        data: {
          userId,
          price,
          validUntil: addSubscriptionMonths(
            now,
            STRIPE_SUBSCRIPTION_EXTENSION_MONTHS
          ),
          // Payment success hoile paymentCount 1 hobe ebong flag true hobe
          paymentCount: 1,
          isPaymentSuccessFull: true,
        },
      });
 
      for (const item of subscriptiondetails) {
        const createdDetail = await tx.subscriptionDetails.create({
          data: {
            subscriptionId: createdSubscription.id,
            subscriptionType: "paid",
            schoolName: item.schoolName,
            country: item.country,
            state: item.state,
            city: item.city,
            area: item.area,
            schoolType: item.schoolType,
            studentLimit: item.studentLimit,
          },
        });
 
        await tx.institutionBranch.create({
          data: {
            userId,
            subscriptionId: createdSubscription.id,
            subscriptionDetailId: createdDetail.id,
            name: item.schoolName,
            type: item.schoolType,
            location: `${item.city}, ${item.state ?? ""}, ${item.country}`,
            annualPriceUsd: pricePerBranch,
          },
        });
      }
 
      const finalSubscription = await tx.subscriptions.findUnique({
        where: { id: createdSubscription.id },
        include: {
          subscriptiondetails: true,
          institutionBranches: true,
        },
      });
 
      return {
        status: true,
        message: "New paid subscription created successfully.",
        data: finalSubscription,
      };
    });
  } catch (error) {
    catchError(error);
 
    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to process Stripe subscription.",
    };
  }
};




const subscriptionServices = {
  saveUserSubscriptionIntoDb,
  findByAllSubscriptionsAdminIntoDb,
   hardDeleteSubscriptionByIdIntoDb,
   findMyAllSubscriptionsIntoDb,
   findMyPaymentStatusIntoDb,
   allCountryListIntoDb,
   allSchoolListIntoDb,
   saveStripeSubscriptionIntoDb
   
};

export default subscriptionServices;
