import { OptionalFees } from "@prisma/client";
import prisma from "../../../shared/prisma";
import catchError from "../../../errors/catchError";
import PrismaRelationQueryBuilder from "../../builder/PrismaQueryBuilder";


const createOptionalFeesIntoDb = async (payload: OptionalFees,subscriptionId: string) => {
  try {
    const result = await prisma.optionalFees.create({
      data: {...payload, subscriptionId},
      
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const findAllOptionalFeesIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaRelationQueryBuilder(query)
      .search([
        "feesName",
        "description",
        "students.name",
        "students.studentId",
      ])
      .filter()
      .sort()
      .paginate();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const result = await prisma.optionalFees.findMany({
      where: {
        subscriptionId,
        ...where,
      },
      orderBy,
      skip,
      take,
      select: {
        id: true,
        feesName: true,
        category: true,
        amount:true,
        status: true,
        frequency: true,
        description: true,
        additionalNote: true,
        isPayment: true ,
        createdAt: true,
        updatedAt: true,
        students: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
      },
    });

    const total = await prisma.optionalFees.count({
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

const findSingleOptionalFeesIntoDb = async (id: string) => {
  try {
    const result = await prisma.optionalFees.findUnique({
      where: {
        id,
      },
      select:{
            id:true,
            feesName:true ,amount:true,
            category:true , status: true ,
            frequency: true ,
            additionalNote:true,
            description:true ,
            isPayment: true,
            createdAt:true ,
            updatedAt:true
            
      }
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const updateOptionalFeesIntoDb = async (
  id: string,
  payload: Partial<OptionalFees>
) => {
  try {
    const result = await prisma.optionalFees.update({
      where: {
        id,
      },
      data: payload,
      include: {
        students: true,
        subscriptions: true,
      },
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const deleteOptionalFeesIntoDb = async (id: string) => {
  try {
    const result = await prisma.optionalFees.delete({
      where: {
        id,
      },
    });

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

 const OptionalFeesServices = {
  createOptionalFeesIntoDb,
  findAllOptionalFeesIntoDb,
  findSingleOptionalFeesIntoDb,
  updateOptionalFeesIntoDb,
  deleteOptionalFeesIntoDb,
};

export default OptionalFeesServices