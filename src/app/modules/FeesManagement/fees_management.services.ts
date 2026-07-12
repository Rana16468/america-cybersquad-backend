import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { TFeesManagement, TStudentFees } from "./fees_management.interface";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { searchable_fees_management } from "./fees_management.constant";

const recordedFeesManagementIntoDb = async (payload: TFeesManagement) => {
  try {

    const { subscriptionId, classLevel, totalFees } = payload;

    const isExistFeesManagement=await prisma.feesManagement.findFirst({
        where:{
            subscriptionId,
            classLevel
        }
    })

   

    if (isExistFeesManagement) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "This class level fee already exists"
      );
    }

    // ✅ create
    await prisma.feesManagement.create({
      data: {
        subscriptionId,
        classLevel,
        totalFees,
      },
    });

    return {
      status: true,
      message: "Successfully recorded",
    };

  } catch (error) {
    return catchError(error);
  }
};

const findByFeesManagementIntoDb = async (
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchable_fees_management)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const result = await prisma.feesManagement.findMany({
      where: {
        subscriptionId,
        isDelete: false,
        ...queryOptions.where,
      },

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        id: true,
        classLevel: true,
        totalFees: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const total = await prisma.feesManagement.count({
      where: {
        subscriptionId,
        isDelete: false,
        ...queryOptions.where,
      },
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      status: true,
      message: "Successfully fetched fees management data",
      meta: {
        page,
        limit,
        total,
        totalPage,
      },
      data: result,
    };

  } catch (error) {
    return catchError(error);
  }
};


const findBySpecificFeesManagementIntoDb = async (id: string) => {
  try {
    return await prisma.feesManagement.findUnique({
      where: { id },
      select: {
        id: true,
        totalFees: true,
        classLevel: true,
      },
    });
  } catch (error) {
    return catchError(error);
  }
};

const updateFeesManagementIntoDb = async (
  id: string,
  payload: Partial<TFeesManagement>
) => {
  try {
    const existing = await prisma.feesManagement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "Fees management not found");
    }

    let updateData: Partial<TFeesManagement> = {};

    if (payload.classLevel !== undefined) {
      updateData.classLevel = payload.classLevel;
    }

    if (payload.totalFees !== undefined) {
      updateData.totalFees = payload.totalFees;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No valid fields provided for update"
      );
    }

    const result = await prisma.feesManagement.update({
      where: { id },
      data: updateData,
    });

    return result && {
      status: true,
      message: "Successfully updated"
     
    };

  } catch (error) {
    throw catchError(error);
  }
};

const studentFeesManuallyReceivedIntoDb = async (
  payload: Partial<TStudentFees>
): Promise<{
  status: true;
  message: string;
}> => {
  try {
    if (!payload.studentId || payload.paidAmount === undefined) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "studentId and paidAmount are required"
      );
    }

    const paidAmount = Number(payload.paidAmount);

    if (isNaN(paidAmount) || paidAmount <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid paid amount");
    }

    return await prisma.$transaction(async (tx) => {

      const student = await tx.student.findFirstOrThrow({
        where: {
          studentId: payload.studentId,
          isVerified: true,
        },
        select: {
          id: true,
          studentId: true,
          className: true,
        },
      });

    
      const fees = await tx.feesManagement.findFirstOrThrow({
        where: {
          classLevel: student.className.toLowerCase(),
        },
        select: {
          id: true,
          totalFees: true,
        },
      });

      const existingFees = await tx.studentFees.findFirst({
        where: {
          studentId: student.studentId,
          feesManagementId: fees.id,
        },
      });

      let totalPaid = paidAmount;

      if (existingFees) {
        totalPaid = existingFees.paidAmount + paidAmount;
      }

      // ❌ Prevent overpayment
      if (totalPaid > fees.totalFees) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Already paid full amount, extra payment not allowed"
        );
      }

      const unpaidAmount = fees.totalFees - totalPaid;

      let paymentStatus: "PAID" | "PARTIAL" | "UNPAID";

      if (totalPaid === fees.totalFees) {
        paymentStatus = "PAID";
      } else if (totalPaid > 0) {
        paymentStatus = "PARTIAL";
      } else {
        paymentStatus = "UNPAID";
      }

      let studentFeesRecord;

      // ✅ Create or Update
      if (existingFees) {
        studentFeesRecord = await tx.studentFees.update({
          where: { id: existingFees.id },
          data: {
            paidAmount: totalPaid,
            unpaidAmount,
            paymentStatus,
            paymentMethod: "MANUAL",
          },
        });
      } else {
        studentFeesRecord = await tx.studentFees.create({
          data: {
            studentId: student.studentId,
            userId: student.id,
            feesManagementId: fees.id,
            paidAmount: totalPaid,
            unpaidAmount,
            paymentStatus, 
            paymentMethod: "MANUAL",
          },
        });
      }

      await tx.paymentHistory.create({
        data: {
          amount: paidAmount,
          studentFeesId: studentFeesRecord.id,
        },
      });

      return {
        status: true,
        message: "Successfully Recorded",
      };
    });
  } catch (error) {
    throw catchError(error);
  }
};


const findByAllPayableFeesIntoDb = async (
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search([])
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const result = await prisma.studentFees.findMany({
      where: {
        feesManagement: {
          subscriptionId,
          isDelete: false,
        },
        isDelete: false,
        ...queryOptions.where,
      },

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        id: true,
        paidAmount: true,
        unpaidAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: {
            studentId: true,
            className:true,
            name:true
                     },
        },

        feesManagement: {
          select: {
            id: true,
            classLevel: true,

            totalFees: true,
          },
        },
      },
    });

    const total = await prisma.studentFees.count({
      where: {
        feesManagement: {
          subscriptionId,
          isDelete: false,
        },
        isDelete: false,
        ...queryOptions.where,
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
      data: result,
    };
  } catch (error) {
    return catchError(error);
  }
};

const findBySpecificFeesManuallyReceivedIntoDb=async(id:string)=>{

    try{

      return await prisma.studentFees.findUnique({where:{id},select:{
        id:true, 
        paidAmount:true,
        unpaidAmount: true , 
        paymentStatus: true
      }})

    }
    catch (error) {
    return catchError(error);
  }
}
const updateFeesManuallyReceivedIntoDb = async (
  id: string,
  payload: Partial<TStudentFees>
):Promise<{status: true , message: string}> => {
  try {
    if (!id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "ID is required");
    }

    if (payload.paidAmount === undefined) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "paidAmount is required for update"
      );
    }

    const newPaidAmount = Number(payload.paidAmount);

    if (isNaN(newPaidAmount) || newPaidAmount < 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid paid amount");
    }

    return await prisma.$transaction(async (tx) => {

      // ✅ Get existing record
      const existingFees = await tx.studentFees.findFirstOrThrow({
        where: {
          id,
  
        },
      });

      // ✅ Get student + fees
      const student = await tx.student.findFirstOrThrow({
        where: {
          studentId: existingFees.studentId,
          isVerified: true,
        },
        select: {
          id: true,
          studentId: true,
          className: true,
        },
      });

      const fees = await tx.feesManagement.findFirstOrThrow({
        where: {
          id: existingFees.feesManagementId,
        },
        select: {
          id: true,
          totalFees: true,
        },
      });


      const totalPaid = newPaidAmount;

      if (totalPaid > fees.totalFees) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Paid amount cannot exceed total fees"
        );
      }

      const unpaidAmount = fees.totalFees - totalPaid;

      let paymentStatus: "PAID" | "PARTIAL" | "UNPAID";

      if (totalPaid === fees.totalFees) {
        paymentStatus = "PAID";
      } else if (totalPaid > 0) {
        paymentStatus = "PARTIAL";
      } else {
        paymentStatus = "UNPAID";
      }

   
      const result = await tx.studentFees.update({
        where: {
          id,
        },
        data: {
          paidAmount: totalPaid,
          unpaidAmount,
          paymentStatus,
          paymentMethod: "MANUAL",
        },
      });

      await tx.paymentHistory.create({
        data: {
          amount: newPaidAmount,
          studentFeesId: result.id,
        },
      });

      return {
        status: true,
        message: "Successfully Updated"
      
      };
    });
  } catch (error) {
    throw catchError(error);
  }
};

const deleteFeesManuallyReceivedIntoDb = async (id: string) => {
  try {
    if (!id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "ID is required");
    }

    return await prisma.$transaction(async (tx) => {
    
      const existingFees = await tx.studentFees.findFirst({
        where: {
          id,
        },
        select:{
          id:true
        }
      });

      if (!existingFees) {
        throw new ApiError(httpStatus.NOT_FOUND, "Fees record not found");
      };

      
      await tx.paymentHistory.deleteMany({
        where: {
          studentFeesId: id,
        },
      });

  
      const result = await tx.studentFees.delete({
        where: {
          id,
        },
      });

      return {
        status: true,
        message: "Successfully Deleted"
      };
    });
  } catch (error) {
    throw catchError(error);
  }
};

const allBranchSpecificEarningManagementIntoDb = async (
  subscriptionId: string,
  query: Record<string, unknown> = {},
) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Total Branch
    const totalBranch = await prisma.branchAdmin.count({
      where: {
        subscriptionId,
      },
    });

    // Paginated Branches
    const branches = await prisma.branchAdmin.findMany({
      where: {
        subscriptionId,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        assignBranch: true,
        students: {
          select: {
            id: true,
            studentFees: {
              select: {
                paidAmount: true,
                unpaidAmount: true,
                feesManagement: {
                  select: {
                    totalFees: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Overall Summary (All Branches)
    const allBranches = await prisma.branchAdmin.findMany({
      where: {
        subscriptionId,
      },
      select: {
        students: {
          select: {
            id: true,
            studentFees: {
              select: {
                paidAmount: true,
                unpaidAmount: true,
                feesManagement: {
                  select: {
                    totalFees: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let overallStudents = 0;
    let overallFees = 0;
    let overallPaid = 0;
    let overallUnpaid = 0;

    for (const branch of allBranches) {
      overallStudents += branch.students.length;

      for (const student of branch.students) {
        for (const fee of student.studentFees) {
          overallFees += Number(fee.feesManagement?.totalFees ?? 0);
          overallPaid += Number(fee.paidAmount ?? 0);
          overallUnpaid += Number(fee.unpaidAmount ?? 0);
        }
      }
    }

    const data = branches.map((branch) => {
      let totalFees = 0;
      let totalPaid = 0;
      let totalUnpaid = 0;

      for (const student of branch.students) {
        for (const fee of student.studentFees) {
          totalFees += Number(fee.feesManagement?.totalFees ?? 0);
          totalPaid += Number(fee.paidAmount ?? 0);
          totalUnpaid += Number(fee.unpaidAmount ?? 0);
        }
      }

      return {
        branchId: branch.id,
        branchName: branch.assignBranch,
        totalStudents: branch.students.length,
        totalFees,
        totalPaid,
        totalUnpaid,
      };
    });

    return {
      meta: {
        page,
        limit,
        total: totalBranch,
        totalPage: Math.ceil(totalBranch / limit),
      },

      overview: {
        totalBranch,
        totalStudents: overallStudents,
        totalFees: overallFees,
        totalPaid: overallPaid,
        totalUnpaid: overallUnpaid,
      },

      data,
    };
  } catch (error) {
    throw catchError(error);
  }
};


const FeesManagementServices = {
  recordedFeesManagementIntoDb,
  findByFeesManagementIntoDb,
  updateFeesManagementIntoDb,
  findBySpecificFeesManagementIntoDb,
  studentFeesManuallyReceivedIntoDb,
  findByAllPayableFeesIntoDb,
  updateFeesManuallyReceivedIntoDb,
  findBySpecificFeesManuallyReceivedIntoDb,
  deleteFeesManuallyReceivedIntoDb,
  allBranchSpecificEarningManagementIntoDb
};

export default FeesManagementServices;