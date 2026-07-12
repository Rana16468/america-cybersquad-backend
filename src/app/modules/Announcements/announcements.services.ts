import { Secret } from "jsonwebtoken";
import config from "../../../config";
import catchError from "../../../errors/catchError";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import { TAnnouncements } from "./announcements.interface";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { getSocketIO } from "../../../socket/connectSocket";
import prisma from "../../../shared/prisma";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { searchable_announcement_field } from "./announcements.constant";
import { UserRole } from "@prisma/client";


const sendAnnouncementsIntoDb = async (
  payload: TAnnouncements,
  verifiedUser:any
): Promise<{ success: true; message: string }> => {
  try {
   

   

    const { isDelete, title, description, audience, subscriptionId } = payload;

    

    // ✅ validation
    if (!title || !description || !subscriptionId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Title, description & subscriptionId required"
      );
    }

    const shortMsg =
      description.length > 20
        ? description.slice(0, 20) + "..."
        : description;

    const io = getSocketIO() as any;

    // ✅ reusable helper
    const createAnnouncementWithNotification = async (
      tx: any,
      field: any
    ) => {
      const announcement = await tx.announcement.create({
        data: {
          title,
          description,
          audience,
          subscriptionId,
          isDelete: isDelete ?? false,
          ...field,
        },
      });

      await tx.notification.create({
        data: {
          title,
          message: shortMsg,
          subscriptionId,
          ...field,
        },
      });

      return announcement;
    };

    switch (verifiedUser.role) {
      case UserRole.BRANCH_ADMIN:
        await prisma.$transaction((tx) =>
          createAnnouncementWithNotification(tx, {
            branchAdminId: verifiedUser.id,
          })
        );
        break;

      case UserRole.ADMIN:
      case UserRole.SUPER_ADMIN:
        await prisma.$transaction((tx) =>
          createAnnouncementWithNotification(tx, {
            userId: verifiedUser.id,
          })
        );
        break;

      case UserRole.TEACHER:
        await prisma.$transaction((tx) =>
          createAnnouncementWithNotification(tx, {
            teacherId: verifiedUser.id,
          })
        );
        break;

      case UserRole.STUDENT:
        await prisma.$transaction((tx) =>
          createAnnouncementWithNotification(tx, {
            studentId: verifiedUser.id,
          })
        );
        break;

      case UserRole.INSTITUTIONAL_OWNER: {
        await prisma.$transaction(async (tx) => {
          // ✅ create announcement
          await tx.announcement.create({
            data: {
              title,
              description,
              audience,
              subscriptionId,
              isDelete: isDelete ?? false,
              userId: verifiedUser.id,
            },
          });

          // ✅ get branch admins
          const branchAdmins = await tx.branchAdmin.findMany({
            where: { subscriptionId },
            select: { id: true },
          });

          // ✅ bulk notifications
          await Promise.all(
            branchAdmins.map((b) =>
              tx.notification.create({
                data: {
                  title,
                  message: shortMsg,
                  branchAdminId: b.id,
                  userId: verifiedUser.id,
                  subscriptionId,
                },
              })
            )
          );

          // ✅ socket emit
          branchAdmins.forEach((b) => {
            io.emit(`notification::${b.id}`, {
              title,
              message: description,
              createdBy: verifiedUser.role,
              timestamp: new Date().toISOString(),
            });
          });
        });

        break;
      }

      default:
        throw new ApiError(httpStatus.FORBIDDEN, "Role not allowed");
    }

    // ✅ audience emit (clean)
    audience?.forEach((role: string) => {
      io.emit(`notification::${role.toUpperCase()}`, {
        title,
        message: description,
        createdBy: verifiedUser.role,
        timestamp: new Date().toISOString(),
      });
    });

    return {
      success: true,
      message: "Successfully sent the announcements",
    };
  } catch (error) {
    return catchError(error);
  }
};


const findByAnnouncementIntoDb = async (
  query: Record<string, unknown>,
  token: string
) => {
  try {
    let verifiedUser;

    try {
      verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt_access_secret as Secret
      ) as {
        id: string;
        email: string;
        role: string;
        iat: number;
        exp: number;
      };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
      }
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access");
    }
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchable_announcement_field)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    let roleFilter: any = {};

    // ✅ ROLE BASED FILTER
    switch (verifiedUser.role) {
      case "BRANCH_ADMIN":
        roleFilter.branchAdminId = verifiedUser.id;
        break;

      case "TEACHER":
        roleFilter.teacherId = verifiedUser.id;
        break;

      case "STUDENT":
        roleFilter.studentId = verifiedUser.id;
        break;

      case "INSTITUTIONAL_OWNER":
      case "SUPER_ADMIN":
      case "ADMIN":
        roleFilter.userId = verifiedUser.id;
        break;

      default:
        throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
    }

    const { isDelete, audience } = query;

    if (isDelete !== undefined) {
      roleFilter.isDelete = isDelete === "true";
    }

    if (audience) {
      roleFilter.audience = {
        has: String(audience).toUpperCase(),
      };
    }

    // ✅ QUERY
    const result = await prisma.announcement.findMany({
      where: {
        ...queryOptions.where,
        ...roleFilter,
      },
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,
      select:{
        id:true,
        title:true,
        description: true ,
        audience:true , 
        isDelete:true ,
        createdAt:true,
        updatedAt:true
      },

      
    });


    const total = await prisma.announcement.count({
      where: {
        ...queryOptions.where,
        ...roleFilter,
      },
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    
    return {
      meta: {
        page,
        limit,
        total,
        totalPage,
      },
      data: result
    };
  } catch (error) {
    return catchError(error);
  }
};


const findAllAnnouncementIntoDb = async (
  query: Record<string, unknown>
) => {
  try {
    // ✅ QUERY BUILDER
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchable_announcement_field)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    // ✅ EXTRA FILTER
    const { isDelete, audience } = query;

    const extraFilter: any = {};

    if (isDelete !== undefined) {
      extraFilter.isDelete = isDelete === "true";
    }

    if (audience) {
      extraFilter.audience = {
        has: String(audience).toUpperCase(),
      };
    }

    // ✅ MAIN QUERY
    const result = await prisma.announcement.findMany({
      where: {
        ...queryOptions.where,
        ...extraFilter,
      },

      include: {
        // ✅ USER
        user: {
          select: {
            id: true,
            schoolName: true,
            branches: true,
            city: true,
            country: true,
            photo: true,
          },
        },

        // ✅ BRANCH ADMIN
        branchAdmin: {
          select: {
            id: true,
            fullName: true,
            emailAddress: true,
            phoneNumber: true,
            photo: true,
          },
        },

        // ✅ TEACHER
        teacher: {
          select: {
            id: true,
            address: true,
            branchName: true,
            photo: true,
          },
        },

        // ✅ SUBSCRIPTIONS + NESTED DETAILS (FIXED)
        subscriptions: {
          select: {
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
      },

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,
    });

    // ✅ COUNT (NO SELECT HERE)
    const total = await prisma.announcement.count({
      where: {
        ...queryOptions.where,
        ...extraFilter,
      },
    });

    // ✅ META
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

const findBySpecificAnnouncementsIntoDb=async(id:string)=>{

  try{

      const result=await prisma.announcement.findUnique({where:{id}, select:{
         id:true,
        title:true,
        description: true ,
        audience:true , 
        isDelete:true ,
        createdAt:true,
        updatedAt:true
      }});

      return result;

  }
  catch (error) {
    return catchError(error);
  }
};

const updateAnnouncementIntoDb = async (
  id: string,
  payload: Partial<TAnnouncements>,
  subscriptionId: string
):Promise<{success: boolean,message: string }> => {
  try {
   
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined)
    );

    delete (cleanPayload as any).id;

    const result = await prisma.announcement.update({
      where: { id },
      data: {
        ...cleanPayload,
        subscriptionId:subscriptionId
      },
    });

    if(!result){
      throw new ApiError(httpStatus.NOT_EXTENDED , 'issues by the update announcement section ', "");
    }

    return {
      success: true,
      message: "Announcement updated successfully"
     
    };
  } catch (error) {
    return catchError(error);
  }
};

const deleteAnnouncementsIntoDb = async (id: string) => {
  try {
  
    const existing = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "Announcement not found");
    }

    await prisma.announcement.delete({
      where: { id },
    });

    return {
      success: true,
      message: "Successfully deleted announcement",
    };
  } catch (error) {
    return catchError(error);
  }
};


const AnnouncementsServices={
    sendAnnouncementsIntoDb,
    findByAnnouncementIntoDb,
     findAllAnnouncementIntoDb,
     findBySpecificAnnouncementsIntoDb,
     updateAnnouncementIntoDb,
     deleteAnnouncementsIntoDb
};



export default  AnnouncementsServices;

