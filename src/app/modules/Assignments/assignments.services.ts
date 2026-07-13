import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { TAssignments, TMaterials } from "./assignments.interface";
import { getSocketIO } from "../../../socket/connectSocket";
import { Prisma, UserRole } from "@prisma/client";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { deleteByPattern, deleteCache, getCache, setCache } from "../../../config/redis";
import { searchableAssignment } from "./assignments.constant";
import { deleteFileIfExists } from "../../../utils/deleteFiles/deleteFileIfExists";
import PrismaRelationQueryBuilder from "../../builder/PrismaQueryBuilder";


const createAssignmentsIntoDb = async (
  teacherId: string,
  subscriptionId: string,
  payload: TAssignments
): Promise<{ status: boolean; message: string }> => {
  try {
    if (
      !payload.assignmentTitle ||
      !payload.assignmentType ||
      !payload.assignmentDueDate ||
      !payload.description ||
      !payload.classDistributionId ||
      !subscriptionId
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Required fields are missing"
      );
    }

    const classDistribution = await prisma.classDistribution.findFirst({
      where: {
        id: payload.classDistributionId,
        teacherId,
        subscriptionId,
      },
      select: {
        id: true,
        students: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!classDistribution) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class distribution not found"
      );
    }

    console.log({
          assignmentTitle: payload.assignmentTitle,
          assignmentType: payload.assignmentType,
          assignmentDueDate: payload.assignmentDueDate,
          description: payload.description,
          attachmentFiles: payload.attachmentFiles ?? [],
          classDistributionId: payload.classDistributionId,
          subscriptionId,
        })

    await prisma.$transaction(async (tx) => {
      await tx.classAssignment.create({
        data: {
          assignmentTitle: payload.assignmentTitle,
          assignmentType: payload.assignmentType,
          assignmentDueDate: payload.assignmentDueDate,
          description: payload.description,
          attachmentFiles: payload.attachmentFiles ?? [],
          classDistributionId: payload.classDistributionId,
          subscriptionId,
        },
      });

      if (classDistribution.students.length > 0) {
        await tx.notification.createMany({
          data: classDistribution.students.map((student) => ({
            title: "📚 New Assignment Added",
            message: "A new assignment has been uploaded.",
            studentId: student.id,
            subscriptionId,
          })),
        });
      }
    });

    const io = getSocketIO() as any;

    const notificationPayload = {
      id: Date.now(),
      title: "📚 New Assignment Added",
      message: "A new assignment has been uploaded.",
      createdBy: UserRole.TEACHER,
      timestamp: new Date().toISOString(),
    };

    // Emit to whole class
    io.to(`class::${payload.classDistributionId}`).emit(
      "notification",
      notificationPayload
    );

    // Emit to each student
    classDistribution.students.forEach((student) => {
      io.to(`user::${student.id}`).emit(
        "notification",
        notificationPayload
      );
    });

    return {
      status: true,
      message: "A new assignment has been uploaded.",
    };
  } catch (error) {
    return catchError(error);
  }
};
const findBySpecificTeacherAssignmentIntoDb = async (
  teacherId: string,
  query: Record<string, unknown>
) => {
  try {
    // const cacheKey = `teacher- :${teacherId}:${JSON.stringify(
    //   query
    // )}`;

    // const cachedData = await getCache(cacheKey);

    // if (cachedData) {
    //   return cachedData;
    // }

    // Remove custom query params before PrismaQueryBuilder
    const {
      status,
      assignmentType,
      classLevel,
      fromDate,
      toDate,
      ...restQuery
    } = query;

    const queryBuilder = new PrismaQueryBuilder(restQuery)
      .search(searchableAssignment)
      .filter()
      .sort()
      .paginate();

    const queryOptions = queryBuilder.build();

    const extraFilter: Record<string, any> = {};

    // Assignment Type (Enum)
    if (assignmentType) {
      extraFilter.assignmentType = assignmentType;
    }

    // Status Filter
    if (status === "completed") {
      extraFilter.assessmentAvailable = true;
    } else if (status === "active") {
      extraFilter.assessmentAvailable = false;
    }

    // Date Filter
    if (fromDate || toDate) {
      extraFilter.assignmentDueDate = {};

      if (fromDate) {
        extraFilter.assignmentDueDate.gte = new Date(fromDate as string);
      }

      if (toDate) {
        extraFilter.assignmentDueDate.lte = new Date(toDate as string);
      }
    }

   
    const classDistributionFilter: Record<string, any> = {
      teacherId,
    };

    if (classLevel) {
      classDistributionFilter.classLevel = classLevel;
    }

    const whereCondition = {
      classDistributions: classDistributionFilter,

      ...queryOptions.where,

      ...extraFilter,
    };

    const [assignments, total] = await prisma.$transaction([
      prisma.classAssignment.findMany({
        where: whereCondition,

        orderBy: queryOptions.orderBy,

        skip: queryOptions.skip,

        take: queryOptions.take,

        select: {
          id: true,
          assignmentTitle: true,
          assignmentType: true,
          assignmentDueDate: true,
          description: true,
          attachmentFiles: true,
          assessmentAvailable: true,
          createdAt: true,
          updatedAt: true,

          classDistributions: {
            select: {
              id: true,
              classLevel: true,
            },
          },
        },
      }),

      prisma.classAssignment.count({
        where: whereCondition,
      }),
    ]);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const response = {
      meta: {
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
      data: assignments,
    };

    // await setCache(cacheKey, response, 600);

    return response;
  } catch (error) {
    return catchError(
      error,
      "Error fetching teacher assignments"
    );
  }
};

const findBySpecificAssignmentIntoDb=async(id:string)=>{

   try{

     return await prisma.classAssignment.findUnique({where:{id},
     select:{
         id: true,
        assignmentTitle: true,
        assignmentType: true,
        assignmentDueDate: true,
        description: true,
        attachmentFiles: true,
        createdAt: true,
        updatedAt: true,
    }});


   }
   catch(error){
    return catchError(
      error,
      "Error fetching teacher assignments"
    );
   }

  
};



const updateClassTeacherAssignmentIntoDb = async (
  id: string,
  payload: Partial<TAssignments>
):Promise<{status: boolean, message:string}> => {
  try {
    const existing = await prisma.classAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        attachmentFiles: true,
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assignment not found", "");
    }


    const updateData: Partial<TAssignments> = {};

    const fieldMap: (keyof TAssignments)[] = [
      "assignmentTitle",
      "assignmentType",
      "assignmentDueDate",
      "description"
     
    ];

    fieldMap.forEach((field) => {
      const value = payload[field];

      if (value !== undefined) {
        if (typeof value === "string") {
          updateData[field] = value.trim() as any;
        } else {
          updateData[field] = value as any;
        }
      }
    });
    if (payload.attachmentFiles?.length) {
      updateData.attachmentFiles = payload.attachmentFiles;

      existing.attachmentFiles?.forEach(deleteFileIfExists);
    }


   await prisma.classAssignment.update({
      where: { id },
      data: updateData,
    });

    return {
      status: true,
      message: "Assignment updated successfully",
      
    };
  } catch (error) {
    return catchError(error);
  }
};

const deleteClassAssignmentIntoDb = async (
  id: string
): Promise<{ status: boolean; message: string }> => {
  try {

    const existing = await prisma.classAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        attachmentFiles: true,
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assignment not found", "");
    }

    if (existing.attachmentFiles?.length) {
      existing.attachmentFiles.forEach(deleteFileIfExists);
    }

    await prisma.classAssignment.delete({
      where: { id },
    });

    await deleteCache(`class-assignment:${id}`);


    await deleteByPattern(`class-assignment:*`);

    return {
      status: true,
      message: "Assignment deleted successfully",
    };
  } catch (error) {
    throw catchError(error);
  }
};

const createClassMaterialsIntoDb = async (
  payload: TMaterials,
  teacherId: string,
  subscriptionId: string
) => {
  try {
    const isExistClassDistributionId =
      await prisma.classDistribution.findFirst({
        where: {
          id: payload.classDistributionId,
          subscriptionId,
          teacherId,
        },
        select: {
          students: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!isExistClassDistributionId) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class distribution not found"
      );
    }

    if (!payload.materialType) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "materialType is required"
      );
    }

    if (
      (!payload.materialFiles || payload.materialFiles.length < 1) &&
      !payload.external_link
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Material file or external link is required"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdMaterial = await tx.classMaterial.create({
        data: {
          subscriptionId,
          classDistributionId: payload.classDistributionId!,
          assignmentTitle:payload.assignmentTitle,
          materialType: payload.materialType,
          description: payload.description,
          materialFiles: payload.materialFiles || [],
          external_link: payload.external_link,
        },
      });

      if (isExistClassDistributionId.students?.length) {
        await tx.notification.createMany({
          data: isExistClassDistributionId.students.map((student) => ({
            title: "📚 New Material Added",
            message: "A new class material has been uploaded.",
            studentId: student.id,
            subscriptionId,
          })),
        });
      }

      return createdMaterial;
    });

    const io = getSocketIO() as any;

    const notificationPayload = {
      id: Date.now(),
      title: "📚 New Material Added",
      message: "A new class material has been uploaded.",
      createdBy: UserRole.TEACHER,
      timestamp: new Date().toISOString(),
    };

    // Class Room Notification
    io.to(`class::${payload.classDistributionId}`).emit(
      "notification",
      notificationPayload
    );

    // Individual Student Notifications
    if (isExistClassDistributionId.students?.length) {
      isExistClassDistributionId.students.forEach((student) => {
        io.to(`user::${student.id}`).emit(
          "notification",
          notificationPayload
        );
      });
    }

    return {
      status: true,
      message: "Class material uploaded successfully",
    };
  } catch (error) {
    throw catchError(error);
  }
};

const findBySpecificTeacherClassMaterialsIntoDb = async (
  classDistributionId: string,
  teacherId: string,
  query: Record<string, unknown>
) => {
  try {
    // const cacheKey = `teacher-materials:${teacherId}:${classDistributionId}:${encodeURIComponent(
    //   JSON.stringify(query)
    // )}`;

    // const cachedData = await getCache(cacheKey);

    // if (cachedData) {
    //   return cachedData;
    // }

    const {
      materialType,
      classLevel,
      createdAt,
      fromDate,
      toDate,
      page,
      limit,
      ...queryData
    } = query;

    const queryBuilder = new PrismaQueryBuilder(queryData)
      .search(["description"])
      .filter()
      .sort()
      .paginate();

    const queryOptions = queryBuilder.build();

    const classDistributionFilter: Prisma.ClassDistributionWhereInput = {
      teacherId,
    };

    if (typeof classLevel === "string" && classLevel.trim() !== "") {
      classDistributionFilter.classLevel = classLevel;
    }

    const whereCondition: Prisma.ClassMaterialWhereInput = {
      classDistributionId,
      classDistributions: {
        is: classDistributionFilter,
      },
    };

    // Material Type Filter (Enum)
    if (typeof materialType === "string" && materialType.trim() !== "") {
      whereCondition.materialType = materialType as any;
    }

    // Single Date Filter
    if (typeof createdAt === "string" && createdAt.trim() !== "") {
      const startDate = new Date(createdAt);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(createdAt);
      endDate.setHours(23, 59, 59, 999);

      whereCondition.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Date Range Filter
    if (
      !createdAt &&
      (typeof fromDate === "string" || typeof toDate === "string")
    ) {
      const dateFilter: Prisma.DateTimeFilter = {};

      if (typeof fromDate === "string" && fromDate.trim() !== "") {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);

        dateFilter.gte = startDate;
      }

      if (typeof toDate === "string" && toDate.trim() !== "") {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        dateFilter.lte = endDate;
      }

      whereCondition.createdAt = dateFilter;
    }

    // Merge QueryBuilder filters
    if (
      queryOptions.where &&
      typeof queryOptions.where === "object" &&
      !Array.isArray(queryOptions.where)
    ) {
      Object.assign(whereCondition, queryOptions.where);
    }

    const result = await prisma.classMaterial.findMany({
      where: whereCondition,
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,
      select: {
        id: true,
        materialType: true,
        assignmentTitle:true ,
        
        description: true,
        external_link: true,
        materialFiles: true,
        createdAt: true,
        updatedAt: true,
        classDistributions: {
          select: {
            id: true,
            classLevel: true,
          },
        },
      },
    });

    const total = await prisma.classMaterial.count({
      where: whereCondition,
    });

    const currentPage =
      typeof page === "string" ? Number(page) : Number(page ?? 1);

    const currentLimit =
      typeof limit === "string" ? Number(limit) : Number(limit ?? 10);

    const response = {
      meta: {
        page: currentPage || 1,
        limit: currentLimit || 10,
        total,
        totalPage: Math.ceil(total / (currentLimit || 10)),
      },
      data: result,
    };

    // await setCache(cacheKey, response, 600);

    return response;
  } catch (error) {
    throw catchError(
      error,
      "Error fetching teacher class materials"
    );
  }
};

const findBySpecificClassMaterialIntoDb=async(id: string)=>{

    try{

      return await prisma.classMaterial.findUnique({where:{id},select:{

        id: true,
        materialType: true,
        description: true,
        external_link: true,
        createdAt: true,
        updatedAt: true,

      }})

    }
    catch(error){
      throw catchError(error);
    }
};

const updateSpecificClassMaterialIntoDb = async (
  id: string,
  payload: Partial<TMaterials>
) => {
  try {
   
    const existing = await prisma.classMaterial.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class material not found"
      );
    }

  
    const updateData: Partial<TMaterials> = {};

    const fieldMap: (keyof TMaterials)[] = [
      "materialType",
      "description",
      "external_link",
    ];

    fieldMap.forEach((field) => {
      const value = payload[field];

      if (value !== undefined) {
        if (typeof value === "string") {
          updateData[field] = value.trim() as any;
        } else {
          updateData[field] = value as any;
        }
      }
    });


    if (payload.materialFiles !== undefined) {
      if (payload.materialFiles.length > 0) {
        updateData.materialFiles = payload.materialFiles;
      } else {
        // optional: allow clearing files
        updateData.materialFiles = [];
      }


      if (existing.materialFiles?.length) {
        existing.materialFiles.forEach(deleteFileIfExists);
      }
    }


    if (Object.keys(updateData).length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No fields provided for update"
      );
    }

   
    const result = await prisma.classMaterial.update({
      where: { id },
      data: updateData,
    });

    return result && {
      success: true,
      message: "Class material updated successfully"
     
    };
  } catch (error) {
    throw catchError(error);
  }
};

const deleteClassMaterialsIntoDb = async (id: string) => {
  try {
    const existing = await prisma.classMaterial.findUnique({
      where: { id },
      select: {
        id: true,
        classDistributionId: true,
        materialFiles: true,
      },
    });

    if (!existing) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class material not found"
      );
    }

    await prisma.classMaterial.delete({
      where: { id: existing.id },
    });

    if (existing.materialFiles?.length) {
      await Promise.allSettled(
        existing.materialFiles.map((file) =>
          deleteFileIfExists(file)
        )
      );
    }


    const classDistributionId =
      existing.classDistributionId;

      

    const teacherCachePattern =
      `teacher-materials:*:${classDistributionId}:*`;

    await deleteByPattern(teacherCachePattern);

    const singleCacheKey = `class-material:${id}`;
    await deleteCache(singleCacheKey);

    const classCacheKey =
      `class-materials:${classDistributionId}`;
    await deleteCache(classCacheKey);

    return {
      success: true,
      message: "Class material deleted successfully",
      deletedId: existing.id,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const submittedAssignmentListIntoDb = async (
  classAssignmentId: string,
  query: Record<string, any>,
) => {
  try {
    const queryBuilder = new PrismaRelationQueryBuilder(query)
      .search([
        "student.name",
        "student.email",
        "student.studentId",
      ])
      .filter()
      .sort()
      .paginate()
      .fields();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const [result, total] = await Promise.all([
      prisma.submitAssignment.findMany({
        where: {
          classAssignmentId,
          isDelete: false,
          ...where,
        },

        orderBy: orderBy.length
          ? orderBy
          : {
              createdAt: "desc",
            },

        skip,
        take,

        select: {
          id: true,
          classAssignments:{
            select:{
              assignmentTitle: true 
            }
          },

          student: {
            select: {
              id: true,
              studentId: true,
              name: true,
              email: true,
              photo: true,
            },
          },

          uploadFiles: {
            select: {
              id: true,
              fileUrl: true,
              createdAt: true,
            },
          },
        },
      }),

      prisma.submitAssignment.count({
        where: {
          classAssignmentId,
          isDelete: false,
          ...where,
        },
      }),
    ]);

    return {
      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
        totalPage: Math.ceil(total / (Number(query.limit) || 10)),
      },
      data: result,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const AssignmentsServices={
    createAssignmentsIntoDb,
    findBySpecificTeacherAssignmentIntoDb,
    findBySpecificAssignmentIntoDb,
    updateClassTeacherAssignmentIntoDb,
    deleteClassAssignmentIntoDb,
    createClassMaterialsIntoDb,
    findBySpecificTeacherClassMaterialsIntoDb,
    findBySpecificClassMaterialIntoDb,
    updateSpecificClassMaterialIntoDb,
    deleteClassMaterialsIntoDb, 
    submittedAssignmentListIntoDb
};

export default AssignmentsServices;

