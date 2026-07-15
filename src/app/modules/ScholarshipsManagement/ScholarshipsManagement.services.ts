import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { TScholarshipsManagement } from "./ScholarshipsManagement.interface";
import PrismaRelationQueryBuilder from "../../builder/PrismaQueryBuilder";


const createScholarshipsManagementIntoDb = async (
  payload: TScholarshipsManagement,
  subscriptionId: string
) => {
  try {
    const isSubscriptionExists = await prisma.subscriptions.findUnique({
      where: {
        id: subscriptionId,
      },
    });

    if (!isSubscriptionExists) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    const result = await prisma.scholarshipsManagement.create({
      data: {
        ...payload,
        subscriptionId,
      },
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const findByAllScholarshipsStudentListIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaRelationQueryBuilder(query)
      .search([
        "description",
        "students.name",
        "students.studentId",
      ])
      .filter()
      .sort()
      .paginate();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const result = await prisma.scholarshipsManagement.findMany({
      where: {
        subscriptionId,
        ...where,
      },
      orderBy,
      skip,
      take,
      select: {
        id: true,
        description: true,
        value: true,
        startDate: true,
        scholarshipsStatus: true,
        createdAt: true,
        updatedAt: true,
        students: {
          select: {
            name: true,
            studentId: true,
          },
        },
      },
    });

    const total = await prisma.scholarshipsManagement.count({
      where: {
        subscriptionId,
        ...where,
      },
    });

    return {
      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
      },
      data: result,
    };
  } catch (error) {
    throw catchError(error);
  }
};
const findBySpecificScholarshipsStudentListIntoDb=async(id: string)=>{

      try{

            const result=await prisma.scholarshipsManagement.findFirst({
                  where:{id}, 
                  select:{
                        id: true,
        description: true,
        value: true,
        startDate: true,
        scholarshipsStatus: true,
        createdAt: true,
        updatedAt: true,
                  }
            });
            return result;

      }
 catch (error) {
    throw catchError(error);
  }
      
};


const updateScholarshipsManagementIntoDb = async (
  id: string,
  payload: Partial<TScholarshipsManagement>
) => {
  try {
    const isExists = await prisma.scholarshipsManagement.findUnique({
      where: {
        id,
      },
    });

    if (!isExists) {
      throw new ApiError(httpStatus.NOT_FOUND, "Scholarship record not found");
    }

    const result = await prisma.scholarshipsManagement.update({
      where: {
        id,
      },
      data: payload,
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const deleteScholarshipsManagementIntoDb = async (id: string) => {
  try {
    const isExists = await prisma.scholarshipsManagement.findUnique({
      where: {
        id,
      },
    });

    if (!isExists) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Scholarship record not found"
      );
    }

    const result = await prisma.scholarshipsManagement.delete({
      where: {
        id,
      },
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const ScholarshipsManagementServices={
      createScholarshipsManagementIntoDb,
      findByAllScholarshipsStudentListIntoDb,
      findBySpecificScholarshipsStudentListIntoDb,
      updateScholarshipsManagementIntoDb,
      deleteScholarshipsManagementIntoDb
};

export default ScholarshipsManagementServices