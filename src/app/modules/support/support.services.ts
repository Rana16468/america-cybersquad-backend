import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { TSupport } from "./support.interface";
import { getSocketIO } from "../../../socket/connectSocket";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { searchable_support_filed } from "./support.constant";
import { UserRole } from "@prisma/client";


const sendSupportMessageIntoDb = async (
  userId: string,
  role: string,
  subscriptionId: string,
  payload: TSupport
) => {
  try {
    const shortMessage =
      payload.message.length > 20
        ? payload.message.slice(0, 20) + "..."
        : payload.message;

    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscriptions.findUnique({
        where: { id: subscriptionId },
        select: {
          userId: true,
          branchAdmins: {
            select: { id: true },
          },
          user: {
            select: { role: true },
          },
        },
      });

      if (!subscription) {
        throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      let supportResult: any;

      switch (role) {
      
        case UserRole.BRANCH_ADMIN: {
          supportResult = await tx.support.create({
            data: {
              subscriptionId: subscriptionId,
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
              isDelete: payload.isDelete ?? false,
              branchAdminId: userId,
            },
          });


          await tx.notification.create({
            data: {
              title: payload.subject,
              message: shortMessage,
              userId: subscription.userId,
              subscriptionId: subscriptionId,
              isDelete: false,
            },
          });

          break;
        }

        
        case UserRole.INSTITUTIONAL_OWNER: {
          supportResult = await tx.support.create({
            data: {
              subscriptionId: subscriptionId,
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
              isDelete: payload.isDelete ?? false,
              userId,
            },
          });

          await Promise.all(
            subscription.branchAdmins.map((admin) =>
              tx.notification.create({
                data: {
                  title: payload.subject,
                  message: shortMessage,
                  branchAdminId: admin.id,
                  subscriptionId: subscriptionId,
                  isDelete: false,
                },
              })
            )
          );

          break;
        }

        // --------------------------------------
        // TEACHER
        // --------------------------------------
        case UserRole.TEACHER: {
          supportResult = await tx.support.create({
            data: {
              subscriptionId: subscriptionId,
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
              isDelete: payload.isDelete ?? false,
              teacherId: userId,
            },
          });

          // branch admins
          await Promise.all(
            subscription.branchAdmins.map((admin) =>
              tx.notification.create({
                data: {
                  title: payload.subject,
                  message: shortMessage,
                  branchAdminId: admin.id,
                  subscriptionId: subscriptionId,
                  isDelete: false,
                },
              })
            )
          );

          if (subscription.user.role === UserRole.INSTITUTIONAL_OWNER) {
            await tx.notification.create({
              data: {
                title: payload.subject,
                message: shortMessage,
                userId: subscription.userId,
                subscriptionId: subscriptionId,
                isDelete: false,
              },
            });
          }

          break;
        }

       
        case UserRole.STUDENT: {


          supportResult = await tx.support.create({
            data: {
              subscriptionId: subscriptionId,
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
              isDelete: payload.isDelete ?? false,
              studentId: userId,
            },
          });

          // branch admins
          await Promise.all(
            subscription.branchAdmins.map((admin) =>
              tx.notification.create({
                data: {
                  title: payload.subject,
                  message: shortMessage,
                  branchAdminId: admin.id,
                  subscriptionId: subscriptionId,
                  isDelete: false,
                },
              })
            )
          );

          // institutional owner
          if (subscription.user.role === UserRole.INSTITUTIONAL_OWNER) {
            await tx.notification.create({
              data: {
                title: payload.subject,
                message: shortMessage,
                userId: subscription.userId,
                subscriptionId: subscriptionId,
                isDelete: false,
              },
            });
          }

          break;
        }

        case UserRole.parent :{

           supportResult = await tx.support.create({
            data: {
              subscriptionId: subscriptionId,
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
              isDelete: payload.isDelete ?? false,
              parentId: userId
            },
          });

            // branch admins
          await Promise.all(
            subscription.branchAdmins.map((admin) =>
              tx.notification.create({
                data: {
                  title: payload.subject,
                  message: shortMessage,
                  branchAdminId: admin.id,
                  subscriptionId: subscriptionId,
                  isDelete: false,
                },
              })
            )
          );

            // institutional owner
          if (subscription.user.role === UserRole.INSTITUTIONAL_OWNER) {
            await tx.notification.create({
              data: {
                title: payload.subject,
                message: shortMessage,
                userId: subscription.userId,
                subscriptionId: subscriptionId,
                isDelete: false,
              },
            });
          }







          break;
        }

        default:
          throw new ApiError(httpStatus.FORBIDDEN, "Role not allowed");
      }

      return supportResult;
    });

    if (!result) {
      throw new ApiError(
        httpStatus.NOT_EXTENDED,
        "Issues sending support message"
      );
    }

    // ======================================
    // SOCKET NOTIFICATION
    // ======================================
    const io = getSocketIO() as any;

    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      select: {
        userId: true,
        branchAdmins: { select: { id: true } },
      },
    });

    const emitNotification = (receiverId: string) => {
      io.emit(`notification::${receiverId}`, {
        id: Date.now(),
        title: payload.subject,
        message: shortMessage,
        createdBy: role,
        timestamp: new Date().toISOString(),
      });
    };

    // branch admins always
    subscription?.branchAdmins.forEach((admin) =>
      emitNotification(admin.id)
    );

    // owner always (if exists)
    if (subscription?.userId) {
      emitNotification(subscription.userId);
    }

    return {
      success: true,
      message: "Successfully sent support message",
    };
  } catch (error) {
    return catchError(error);
  }
};

const findByAllSupportIntoDb = async (
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchable_support_filed)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const { isDelete, subscriptionId } = query;

    const extraFilter: any = {};

    if (isDelete !== undefined) {
      extraFilter.isDelete = isDelete === "true";
    }

    if (subscriptionId) {
      extraFilter.subscriptionId = String(subscriptionId);
    }

    const result = await prisma.support.findMany({
      where: {
        ...queryOptions.where,
        ...extraFilter,
      },

      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          select: {
            id: true,
            price: true,
            createdAt: true,
            subscriptiondetails: {
              select: {
                subscriptionType: true,
                schoolName: true,
                country: true,
                state: true,
                city: true,
                area: true,
              },
            },
          },
        },

        branchAdmin: {
          select: {
            id: true,
            fullName: true,
            emailAddress: true,
            phoneNumber: true,
            photo: true,
          },
        },

        user: {
          select: {
            id: true,
            schoolName: true,
            city: true,
            country: true,
            photo: true,
          },
        },
      },

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,
    });

    const total = await prisma.support.count({
      where: {
        ...queryOptions.where,
        ...extraFilter,
      },
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: result,
    };
  } catch (error) {
    return catchError(error);
  }
};

const deleteSupportIntoDb = async (id: string) => {
  try {
    await prisma.support.delete({
      where: { id },
    });

    return {
      success: true,
      message: "Successfully deleted support message",
    };
  } catch (error) {
    return catchError(error);
  }
};

const SupportServices={
    sendSupportMessageIntoDb,
    findByAllSupportIntoDb,
     deleteSupportIntoDb
};
export default SupportServices;

