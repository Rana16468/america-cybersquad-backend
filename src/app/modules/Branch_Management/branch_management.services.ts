import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { TBranchAdmin } from "./branch_management.interface";
import bcrypt from "bcrypt";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import branchManagementConstants from "./branch_management.constant";
import { JwtPayload } from "jsonwebtoken";
import { generateOtp } from "../../../utils/generateOtp";
import sendEmail from "../../../utils/sendEmail";
import emailContext from "../../../utils/emailcontext/sendvarificationData";
import { AttendanceStatus } from "@prisma/client";
import { getCache, setCache } from "../../../config/redis";
import PrismaRelationQueryBuilder from "../../builder/PrismaQueryBuilder";

const formatBranchType = (type: string) => {
  const normalizedType = type.trim().toLowerCase();

  if (
    normalizedType.includes("primary") &&
    (normalizedType.includes("secondary") || normalizedType.includes("high"))
  ) {
    return "Primary & Secondary";
  }

  if (normalizedType.includes("secondary") || normalizedType.includes("high")) {
    return "Secondary School";
  }

  return "Primary School";
};

const buildLocation = (city?: string | null, state?: string | null, country?: string | null) =>
  [city, state, country].filter(Boolean).join(", ");

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type InstitutionBranchMetrics = {
  id: string;
  name: string;
  type: string;
  students: number;
  teachers: number;
  attendance: number;
  earnings: number;
  location: string;
  contact: string;
  annualPriceUsd: number;
  pricingRuleVersion: string | null;
  isOverridden: boolean;
  overrideReason: string | null;
};

const syncInstitutionBranchesFromSubscriptions = async (userId: string) => {
  const subscriptions = await prisma.subscriptions.findMany({
    where: {
      userId,
      isDeleted: false,
    },
    include: {
      subscriptiondetails: {
        where: {
          isDeleted: false,
        },
      },
    },
  });

  for (const subscription of subscriptions) {
    const branchCount = subscription.subscriptiondetails.length || 1;
    const perBranchAnnualPrice = roundCurrency(subscription.price / branchCount);

    for (const detail of subscription.subscriptiondetails) {
      const existingBranch = await prisma.institutionBranch.findFirst({
        where: {
          userId,
          subscriptionDetailId: detail.id,
        },
      });

      if (!existingBranch) {
        await prisma.institutionBranch.create({
          data: {
            userId,
            subscriptionId: subscription.id,
            subscriptionDetailId: detail.id,
            name: detail.schoolName,
            type: formatBranchType(detail.schoolType),
            location: buildLocation(detail.city, detail.state, detail.country),
            contact: null,
            annualPriceUsd: perBranchAnnualPrice,
            pricingRuleVersion: "subscription-sync-v1",
          },
        });

        continue;
      }

      if (!existingBranch.isOverridden) {
        await prisma.institutionBranch.update({
          where: {
            id: existingBranch.id,
          },
          data: {
            subscriptionId: subscription.id,
            annualPriceUsd: perBranchAnnualPrice,
          },
        });
      }
    }
  }
};

const getInstitutionBranchMetrics = async (branch: {
  id: string;
  name: string;
  type: string;
  location: string;
  contact: string | null;
  annualPriceUsd: number;
  pricingRuleVersion: string | null;
  isOverridden: boolean;
  overrideReason: string | null;
}): Promise<InstitutionBranchMetrics> => {
  const [studentsCount, teachersCount, attendanceTotal, attendancePresent, earningsAggregate] =
    await Promise.all([
      prisma.student.count({
        where: {
          branchName: branch.name,
          isDeleted: false,
        },
      }),
      prisma.teacher.count({
        where: {
          branchName: branch.name,
          isDeleted: false,
        },
      }),
      prisma.attendanceSheet.count({
        where: {
          students: {
            branchName: branch.name,
          },
          isDelete: false,
        },
      }),
      prisma.attendanceSheet.count({
        where: {
          students: {
            branchName: branch.name,
          },
          attendanceStatus: AttendanceStatus.PRESENT,
          isDelete: false,
        },
      }),
      prisma.studentFees.aggregate({
        _sum: {
          paidAmount: true,
        },
        where: {
          isDelete: false,
          student: {
            branchName: branch.name,
          },
        },
      }),
    ]);

  const attendanceRate = attendanceTotal
    ? Number(((attendancePresent / attendanceTotal) * 100).toFixed(1))
    : 0;
  const earningsUsd = roundCurrency(earningsAggregate._sum.paidAmount || 0);

  return {
    id: branch.id,
    name: branch.name,
    type: branch.type,
    students: studentsCount,
    teachers: teachersCount,
    attendance: attendanceRate,
    earnings: earningsUsd,
    location: branch.location,
    contact: branch.contact || "Not available",
    annualPriceUsd: branch.annualPriceUsd,
    pricingRuleVersion: branch.pricingRuleVersion,
    isOverridden: branch.isOverridden,
    overrideReason: branch.overrideReason,
  };
};

const create_branch_admin_IntoDb = async (
  userId: string,
  payload: TBranchAdmin
) => {
  try {
    const {
      fullName,
      phoneNumber,
      emailAddress,
      password,
      role,
      joinDate,
      assignBranch,
      subscriptionId
    } = payload;
    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds)
    );

    // ⚡ Parallel duplicate checks
    const [ branchExists] = await Promise.all([
     
      prisma.branchAdmin.findUnique({ where: { emailAddress } }),
    ]);


    if (branchExists) {
      throw new ApiError(httpStatus.CONFLICT, "Branch Under User already assigned");
    }

  
    const result = await prisma.branchAdmin.create({
      data: {
        fullName,
        phoneNumber,
        emailAddress,
        password: hashedPassword,
        joinDate: new Date(joinDate),
        assignBranch,
        subscriptionId,
        role,
        userId,
      },
    });

    if(!result){
        throw new ApiError(httpStatus.NOT_EXTENDED, 'issues by the branch admin recorded section ')
    }

    return {
      status: true,
      message: "Branch admin created successfully"
    };
  } catch (error) {
    return catchError(error);
  }
};

const findSubscriptionBranchByIdIntoDb = async (
  userId: string,
  subscriptionId: string
) => {
  try {
    const result = await prisma.subscriptions.findUnique({
      where: {
        id: subscriptionId,
        userId,
      },
      select: {
        id: true,
        price: true,

        subscriptiondetails: {
          select: {
            id: true,
            subscriptionType: true
            
          },
        },
      },
    });

    if (!result) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Subscription not found or unauthorized"
      );
    }

    return {
      status: true,
      message: "Subscription fetched successfully",
      data: result,
    };
  } catch (error) {
    catchError(error);

    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch subscription",
    };
  }
};


const login_branch_admin_IntoDb = async (payload: { emailAddress: string; password: string }) => {


  try {
    const { emailAddress, password } = payload; 

   const branchAdmin = await prisma.branchAdmin.findUnique({
      where: { emailAddress },
      select: {
        id: true,
        role: true,
        emailAddress: true,
        password: true,
        
      }
    });

    if (!branchAdmin) {
      throw new ApiError(httpStatus.NOT_FOUND, "Branch admin not found");
    };

    const isPasswordMatched = await bcrypt.compare(
        password,
        branchAdmin.password
      );

      if (!isPasswordMatched) {
        throw new ApiError(httpStatus.FORBIDDEN, "Password not matched", "");
      }

      const jwtPayload = {
        id: branchAdmin.id,
        role: branchAdmin.role,
        email: branchAdmin.emailAddress,
      };

      const accessToken = jwtHelpers.generateToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.expires_in as string
      );

      const refreshToken = jwtHelpers.generateToken(
        jwtPayload,
        config.jwt_refresh_secret as string,
        config.refresh_expires_in as string
      );

      return {
        accessToken,
        refreshToken,
      };

  } catch (error) {
    return catchError(error);
  }};


const findByAllBranchIntoDb = async (
  userId: string,
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(branchManagementConstants.searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    // 👉 custom filters
    const { joinDateFrom, joinDateTo, branchName } = query;

    const extraFilter: any = {};

    // ✅ branch filter
    if (branchName) {
      extraFilter.assignBranch = {
        contains: String(branchName),
        mode: "insensitive",
      };
    }

    // ✅ join date range filter
    if (joinDateFrom || joinDateTo) {
      extraFilter.joinDate = {};

      if (joinDateFrom) {
        extraFilter.joinDate.gte = new Date(joinDateFrom as string);
      }

      if (joinDateTo) {
        extraFilter.joinDate.lte = new Date(joinDateTo as string);
      }
    }

    // ✅ FINAL WHERE
    const whereCondition = {
      ...queryOptions.where,
      userId: userId,
      ...extraFilter,
    };

    // ✅ DATA QUERY
    const result = await prisma.branchAdmin.findMany({
      where: whereCondition,
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: queryOptions.select || {
        id: true,
        fullName: true,
        phoneNumber: true,
        emailAddress: true,
        role: true,
        joinDate: true,
        assignBranch: true,
        createdAt: true,
        updatedAt: true

      },
    });

    // ✅ TOTAL COUNT
    const total = await prisma.branchAdmin.count({
      where: whereCondition,
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

const updateByBranchAdminIntoDb = async (
  id: string,
  payload: Partial<TBranchAdmin>,
  userId: string
): Promise<{ status: boolean; message: string }> => {
  try {
    // 🔍 Step 1: Check ownership + existence
    const existingBranchAdmin = await prisma.branchAdmin.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingBranchAdmin) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Branch admin not found or unauthorized"
      );
    }

    const updatedPayload: Partial<TBranchAdmin> = { ...payload };

    if (updatedPayload.joinDate) {
      updatedPayload.joinDate = new Date(
        updatedPayload.joinDate
      );
    }

    await prisma.branchAdmin.update({
      where: {
        id
      },
      data: updatedPayload,
    });

  
    return {
      status: true,
      message: "Branch admin updated successfully",
    };
  } catch (error) {
    return catchError(error);
  }
};



const deleteBranchAdminIntoDb = async (id: string, userId: string) : Promise<{ status: boolean; message: string }> => {
  try {
    const existingBranchAdmin = await prisma.branchAdmin.findFirst({  where: { id, userId }, select: { id: true } }); 

    if (!existingBranchAdmin) {
      throw new ApiError(httpStatus.NOT_FOUND, "Branch admin not found or unauthorized");
    } 
    await prisma.branchAdmin.delete({ where: { id } });

    return { 
      status: true,
      message: "Branch admin deleted successfully",
    };
  } catch (error) {
    return catchError(error);
  };      
     }
  

const findByAllBranchAdminIntoDb = async (
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(branchManagementConstants.searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const { joinDateFrom, joinDateTo, branchName } = query;
    const extraFilters: any[] = [];
    if (branchName) {
      extraFilters.push({
        assignBranch: {
          contains: String(branchName),
          mode: "insensitive",
        },
      });
    }
    if (joinDateFrom || joinDateTo) {
      const dateFilter: any = {};

      if (joinDateFrom && !isNaN(Date.parse(joinDateFrom as string))) {
        dateFilter.gte = new Date(joinDateFrom as string);
      }

      if (joinDateTo && !isNaN(Date.parse(joinDateTo as string))) {
        dateFilter.lte = new Date(joinDateTo as string);
      }

      if (Object.keys(dateFilter).length > 0) {
        extraFilters.push({ joinDate: dateFilter });
      }
    }
    const whereCondition = {
      AND: [queryOptions.where, ...extraFilters],
    };

    // ✅ DATA QUERY (FIXED: no select + include conflict)
    const result = await prisma.branchAdmin.findMany({
      where: whereCondition,
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        ...(queryOptions.select || {
          id: true,
          fullName: true,
          phoneNumber: true,
          emailAddress: true,
          role: true,
          joinDate: true,
          assignBranch: true,
          createdAt: true,
          updatedAt: true,
        }),

        // ✅ include relation via select
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            city: true,
            country: true,
            role: true,
          },
        },
      },
    });

    const total = await prisma.branchAdmin.count({
      where: whereCondition,
    });

    const page = Number(query?.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query?.limit) > 0 ? Number(query.limit) : 10;
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


const changePasswordBranchAdminIntoDb = async (
  id: string,
  payload: { oldPassword: string; newPassword: string }
  
) => {


  console.log("Changing password for branch admin ID:", id, payload);
  try {
    const user = await prisma.branchAdmin.findFirst({
      where: {
        id,
      },
      select: {
        password: true,
      },
    });

  

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "Branch admin not found", "");
    }

    // 2️⃣ Compare old password
    const isMatch = await bcrypt.compare(payload.oldPassword, user.password);
    console.log("Old password match result:", isMatch);

    if (!isMatch) {
      throw new ApiError(httpStatus.FORBIDDEN, "Old password does not match", "");
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, Number(config.bcrypt_salt_rounds));
    
    const result=await prisma.branchAdmin.update({
      where: { id },
      data: { password: hashedPassword },
    });
    if(!result){
        throw new ApiError(httpStatus.NOT_EXTENDED, 'Issue occurred while changing password')
    }

    

    return {
      success: true,
      message: "Password updated successfully",
    };
  } catch (error) {
     return  catchError(error);
  }
};


const refreshTokenBranchAdminIntoDb = async (token: string) => {
  try {
    if (!token) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized", "");
    }

    const decoded = jwtHelpers.verifyToken(
      token,
      config.jwt_refresh_secret as string
    ) as JwtPayload;

    const { id } = decoded;
    const isUserExist = await prisma.branchAdmin.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
       emailAddress: true,
        role: true,
  
      },
    });

    if (!isUserExist) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
    }


    const jwtPayload = {
      id: isUserExist.id,
      email: isUserExist.emailAddress,
      role: isUserExist.role,
    };

    const accessToken = jwtHelpers.generateToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.expires_in as string
    );

    return {
      accessToken,
    };
  } catch (error) {
    catchError(error);
   
  }
};


const forgotPasswordBranchADminIntoDb = async (
  payload: string | { emailAddress: string }
): Promise<{ status: boolean; message: string }> => {
  try {
    let emailString: string;

    if (typeof payload === "string") {
      emailString = payload;
    } else if (
      payload &&
      typeof payload === "object" &&
      "emailAddress" in payload
    ) {
      emailString = payload.emailAddress;
    } else {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid email format"
      );
    }

 
    const result = await prisma.$transaction(async (tx) => {
      const isExistUser = await tx.branchAdmin.findUnique({
        where: {
          emailAddress: emailString, // 🔥 FIXED
        },
        select: {
          id: true,
          emailAddress: true,
        },
      });

      if (!isExistUser) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          "Branch admin not found"
        );
      }
      const otp = Number(generateOtp());

      const updatedUser = await tx.branchAdmin.update({
        where: {
          id: isExistUser.id,
        },
        data: {
          verificationCode: otp,
          createdAt: new Date(), // 🔥 track OTP creation time
        },
        select: {
          id: true,
          emailAddress: true,
        },
      });

      if (!updatedUser) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to save OTP"
        );
      }

      try {
        await sendEmail(
          emailString,
          emailContext.sendVerificationData(
            emailString,
            otp,
            "Forgot Password Email"
          ),
          "Forgot Password Verification OTP Code"
        );
      } catch (emailError: any) {
        throw new ApiError(
          httpStatus.SERVICE_UNAVAILABLE,
          "Failed to send verification email",
          emailError
        );
      }
      return {
        status: true,
        message: "Check your email for OTP",
      };
    });

    return result;
  } catch (error) {
    return catchError(error);
  }
};

const verificationForgotBranchAdminIntoDb = async (
  otp: number | { verificationCode: number }
): Promise<{ status: boolean; resetToken: string }> => {
  try {
    let code: number;

    // ✅ 1. Extract OTP safely
    if (typeof otp === "object" && typeof otp.verificationCode === "number") {
      code = otp.verificationCode;
    } else if (typeof otp === "number") {
      code = otp;
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP format");
    }

    // ✅ 2. Find Branch Admin (FIXED TABLE)
    const isExistOtp = await prisma.branchAdmin.findFirst({
      where: {
        verificationCode: code,
      },
      select: {
        id: true,
        emailAddress: true,
        role: true,
        createdAt: true,
       
      },
    });

    if (!isExistOtp) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invalid OTP");
    }

    

    // ✅ 3. OTP Expiry Check (CORRECT WAY)
    const now = Date.now();
    const otpTime = new Date(isExistOtp.createdAt).getTime();
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (now - otpTime > FIVE_MINUTES) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "OTP has expired. Please request a new one."
      );
    }

    // ✅ 4. Generate RESET TOKEN (NOT access token)
    const resetToken = jwtHelpers.generateToken(
      {
        id: isExistOtp.id,
        email: isExistOtp.emailAddress,
        role: isExistOtp.role,
        purpose: "RESET_PASSWORD", // 🔥 important
      },
      config.jwt_access_secret as string,
      "10m" 
    );

    await prisma.branchAdmin.update({
      where: { id: isExistOtp.id },
      data: {
        verificationCode: null
        
      },
    });

    return {
      status: true,
      resetToken,
    };
  } catch (error) {
    return catchError(error);
  }
};


const resetPasswordBranchAdminIntoDb = async (payload: {
  resetToken: string;
  newPassword: string;
}): Promise<{ status: boolean; message: string }> => {
  try {
    const { resetToken, newPassword } = payload;

    if (!resetToken || !newPassword) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Reset token and new password are required"
      );
    }

    const decoded = jwtHelpers.verifyToken(
      resetToken,
      config.jwt_access_secret as string
    ) as any;

    if (!decoded || decoded.purpose !== "RESET_PASSWORD") {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Invalid or expired reset token"
      );
    }


    const user = await prisma.branchAdmin.findUnique({
      where: { id: decoded.id },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }


    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (isSamePassword) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "New password must be different from old password"
      );
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      Number(config.bcrypt_salt_rounds)
    );

  
    await prisma.branchAdmin.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });


    return {
      status: true,
      message: "Password reset successfully",
    };
  } catch (error) {
    return catchError(error);
  }
};

const findInstitutionBranchOptionsIntoDb = async (
  subscriptionId: string,
  query: Record<string, any> = {},
) => {
  try {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [branchDetails, totalBranches, totalTeacher, totalStudent] =
      await Promise.all([
        prisma.institutionBranch.findMany({
          where: { subscriptionId, isDeleted: false },
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
            contact: true,
            annualPriceUsd: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),

        prisma.institutionBranch.count({
          where: { subscriptionId, isDeleted: false },
        }),

        prisma.teacher.count({
          where: { subscriptionId, isDeleted: false },
        }),

        prisma.student.count({
          where: { subscriptionId, isDeleted: false },
        }),
      ]);

    const result = await Promise.all(
      branchDetails.map(async (branch) => {
        const branchName = branch.name;

        const [
          branchStudentCount,
          branchTeacherCount,
          totalAttendanceRecords,
          presentAttendanceRecords,
          feesTotals,
        ] = await Promise.all([
          prisma.student.count({
            where: { subscriptionId, branchName, isDeleted: false },
          }),
          prisma.teacher.count({
            where: { subscriptionId, branchName, isDeleted: false },
          }),
          prisma.attendanceSheet.count({
            where: { isDelete: false, subscriptionId, students: { branchName } },
          }),
          prisma.attendanceSheet.count({
            where: {
              isDelete: false,
              subscriptionId,
              attendanceStatus: "PRESENT",
              students: { branchName },
            },
          }),
          prisma.studentFees.aggregate({
            _sum: { paidAmount: true, unpaidAmount: true },
            where: {
              isDelete: false,
              student: { branchName, subscriptionId },
              feesManagement: { subscriptionId, isDelete: false },
            },
          }),
        ]);

        const averageAttendance =
          totalAttendanceRecords > 0
            ? Number(((presentAttendanceRecords / totalAttendanceRecords) * 100).toFixed(2))
            : 0;

        return {
          id: branch.id,
          branchName: branch.name,
          type: branch.type,
          location: branch.location,
          contact: branch.contact,
          annualFee: branch.annualPriceUsd,
          createdAt: branch.createdAt,
          updatedAt: branch.updatedAt,
          statistics: {
            totalStudent: branchStudentCount,
            totalTeacher: branchTeacherCount,
            averageAttendance,
            paidFees: feesTotals._sum.paidAmount ?? 0,
            unpaidFees: feesTotals._sum.unpaidAmount ?? 0,
          },
        };
      }),
    );

    return {
      overall: { totalTeacher, totalStudent },
      meta: { page, limit, total: totalBranches, totalPage: Math.ceil(totalBranches / limit) },
      data: result,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const findInstitutionBranchStatsIntoDb = async (
  userId: string,
  branchId?: string
) => {
  await syncInstitutionBranchesFromSubscriptions(userId);

  const branchFilter =
    branchId && branchId !== "all"
      ? {
          id: branchId,
        }
      : {};

  const branches = await prisma.institutionBranch.findMany({
    where: {
      userId,
      isDeleted: false,
      ...branchFilter,
    },
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      contact: true,
      annualPriceUsd: true,
      pricingRuleVersion: true,
      isOverridden: true,
      overrideReason: true,
    },
  });

  const metrics: InstitutionBranchMetrics[] = await Promise.all(branches.map(getInstitutionBranchMetrics));

  const totalStudents = metrics.reduce((sum: number, item: InstitutionBranchMetrics) => sum + item.students, 0);
  const totalTeachers = metrics.reduce((sum: number, item: InstitutionBranchMetrics) => sum + item.teachers, 0);
  const totalEarnings = metrics.reduce((sum: number, item: InstitutionBranchMetrics) => sum + item.earnings, 0);
  const averageAttendance = metrics.length
    ? Number(
        (
          metrics.reduce((sum: number, item: InstitutionBranchMetrics) => sum + item.attendance, 0) / metrics.length
        ).toFixed(1)
      )
    : 0;

  return {
    totalStudents,
    totalTeachers,
    averageAttendance,
    totalEarnings: roundCurrency(totalEarnings),
    studentChange: "+0%",
    teacherChange: "+0%",
    attendanceChange: "+0%",
    earningsChange: "+0%",
  };
};

const findInstitutionBranchesIntoDb = async (
  userId: string,
  query: Record<string, unknown>
) => {
  await syncInstitutionBranchesFromSubscriptions(userId);

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 8, 1);
  const skip = (page - 1) * limit;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const branchId =
    typeof query.branchId === "string" && query.branchId !== "all"
      ? query.branchId
      : undefined;

  const whereClause: any = {
    userId,
    isDeleted: false,
  };

  if (branchId) {
    whereClause.id = branchId;
  }

  if (search) {
    whereClause.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        type: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        location: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  const [branches, total] = await Promise.all([
    prisma.institutionBranch.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "asc",
      },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        location: true,
        contact: true,
        annualPriceUsd: true,
        pricingRuleVersion: true,
        isOverridden: true,
        overrideReason: true,
      },
    }),
    prisma.institutionBranch.count({
      where: whereClause,
    }),
  ]);

  const data = await Promise.all(branches.map(getInstitutionBranchMetrics));

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const createInstitutionBranchIntoDb = async (
  userId: string,
  payload: {
    name: string;
    type: string;
    location: string;
    contact: string;
  }
) => {
  const existingBranch = await prisma.institutionBranch.findFirst({
    where: {
      userId,
      name: payload.name,
      isDeleted: false,
    },
    select: {
      id: true,
    },
  });

  if (existingBranch) {
    throw new ApiError(httpStatus.CONFLICT, "Branch name already exists");
  }

  const branch = await prisma.institutionBranch.create({
    data: {
      userId,
      name: payload.name,
      type: payload.type,
      location: payload.location,
      contact: payload.contact,
      annualPriceUsd: 0,
      pricingRuleVersion: "manual-v1",
    },
  });

  return branch;
};

const updateInstitutionBranchIntoDb = async (
  userId: string,
  branchId: string,
  payload: Partial<{
    name: string;
    type: string;
    location: string;
    contact: string;
  }>
) => {
  const branch = await prisma.institutionBranch.findFirst({
    where: {
      id: branchId,
      userId,
      isDeleted: false,
    },
  });

  if (!branch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Institution branch not found");
  }

  const oldBranchName = branch.name;
  const nextBranchName = payload.name?.trim();

  await prisma.institutionBranch.update({
    where: {
      id: branchId,
    },
    data: payload,
  });

  if (nextBranchName && nextBranchName !== oldBranchName) {
    if (branch.subscriptionId) {
      await Promise.all([
        prisma.branchAdmin.updateMany({
          where: {
            subscriptionId: branch.subscriptionId,
            assignBranch: oldBranchName,
          },
          data: {
            assignBranch: nextBranchName,
          },
        }),
        prisma.student.updateMany({
          where: {
            subscriptionId: branch.subscriptionId,
            branchName: oldBranchName,
          },
          data: {
            branchName: nextBranchName,
          },
        }),
        prisma.teacher.updateMany({
          where: {
            subscriptionId: branch.subscriptionId,
            branchName: oldBranchName,
          },
          data: {
            branchName: nextBranchName,
          },
        }),
      ]);
    }
  }

  return {
    status: true,
    message: "Institution branch updated successfully",
  };
};

const overrideInstitutionBranchPriceIntoDb = async (
  userId: string,
  branchId: string,
  payload: {
    annualPriceUsd: number;
    overrideReason: string;
  }
) => {
  const branch = await prisma.institutionBranch.findFirst({
    where: {
      id: branchId,
      userId,
      isDeleted: false,
    },
    select: {
      id: true,
    },
  });

  if (!branch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Institution branch not found");
  }

  await prisma.institutionBranch.update({
    where: {
      id: branchId,
    },
    data: {
      annualPriceUsd: payload.annualPriceUsd,
      isOverridden: true,
      overrideReason: payload.overrideReason,
      pricingRuleVersion: "manual-override-v1",
    },
  });

  return {
    status: true,
    message: "Institution branch pricing updated successfully",
  };
};

const deleteInstitutionBranchIntoDb = async (userId: string, branchId: string) => {
  const branch = await prisma.institutionBranch.findFirst({
    where: {
      id: branchId,
      userId,
      isDeleted: false,
    },
    select: {
      id: true,
    },
  });

  if (!branch) {
    throw new ApiError(httpStatus.NOT_FOUND, "Institution branch not found");
  }

  await prisma.institutionBranch.update({
    where: {
      id: branchId,
    },
    data: {
      isDeleted: true,
    },
  });

  return {
    status: true,
    message: "Institution branch deleted successfully",
  };
};


const CACHE_TTL = 60 * 5; 

 const branchManagementTotalCountIntoDb = async (
  subscriptionId: string
) => {
  try {
    const cacheKey = `dashboard:branch-total-count:${subscriptionId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const [
      totalTeacher,
      totalBranch,
      totalStudent,
      totalFees,
      studentFeesSummary,
    ] = await Promise.all([
      prisma.teacher.count({
        where: {
          subscriptionId,
        },
      }),

      prisma.branchAdmin.count({
        where: {
          subscriptionId,
        },
      }),

      prisma.student.count({
        where: {
          subscriptionId,
        },
      }),

      prisma.feesManagement.aggregate({
        where: {
          subscriptionId,
          isDelete: false,
        },
        _sum: {
          totalFees: true,
        },
      }),

      prisma.studentFees.aggregate({
        where: {
          isDelete: false,
          feesManagement: {
            subscriptionId,
          },
        },
        _sum: {
          paidAmount: true,
          unpaidAmount: true,
        },
      }),
    ]);

    const result = {
      totalTeacher,
      totalBranch,
      totalStudent,
      totalFees: totalFees._sum.totalFees ?? 0,
      totalPaidAmount: studentFeesSummary._sum.paidAmount ?? 0,
      totalUnpaidAmount: studentFeesSummary._sum.unpaidAmount ?? 0,
    };

    // Save Cache
    await setCache(cacheKey, result, CACHE_TTL);

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const studentGrowthIntoDb = async (
  subscriptionId: string,
  query: { year?: string }
) => {
  try {

    const year = query.year
      ? parseInt(query.year)
      : new Date().getFullYear();

    const cacheKey = `student-growth:${subscriptionId}:${year}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const previousYear = year - 1;

    const currentYearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const currentYearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    const previousYearStart = new Date(
      `${previousYear}-01-01T00:00:00.000Z`
    );
    const previousYearEnd = new Date(
      `${previousYear}-12-31T23:59:59.999Z`
    );

    const [currentYearStudents, previousYearTotal] = await Promise.all([
      prisma.student.findMany({
        where: {
          subscriptionId,
          createdAt: {
            gte: currentYearStart,
            lte: currentYearEnd,
          },
        },
        select: {
          createdAt: true,
        },
      }),

      prisma.student.count({
        where: {
          subscriptionId,
          createdAt: {
            gte: previousYearStart,
            lte: previousYearEnd,
          },
        },
      }),
    ]);

    const monthCounts = Array.from({ length: 12 }, (_, index) => ({
      year,
      month: index + 1,
      count: 0,
    }));

    currentYearStudents.forEach((student) => {
      const month = student.createdAt.getMonth(); 
      monthCounts[month].count++;
    });

    const currentYearTotal = currentYearStudents.length;

    let yearlyGrowth = 0;

    if (previousYearTotal > 0) {
      yearlyGrowth =
        ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    } else if (currentYearTotal > 0) {
      yearlyGrowth = 100;
    }

    const result = {
      monthlyStats: monthCounts,
      yearlyGrowth: Number(yearlyGrowth.toFixed(2)),
      year,
      totalStudents: currentYearTotal,
      previousYearTotal,
    };

    
    await setCache(cacheKey, result, CACHE_TTL);

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const earningGrowthIntoDb = async (
  subscriptionId: string,
  query: { year?: string }
) => {
  try {
    const year = query.year
      ? parseInt(query.year)
      : new Date().getFullYear();

    const cacheKey = `earning-growth:${subscriptionId}:${year}`;

    // Check Cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const previousYear = year - 1;

    const currentYearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const currentYearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    const previousYearStart = new Date(
      `${previousYear}-01-01T00:00:00.000Z`
    );
    const previousYearEnd = new Date(
      `${previousYear}-12-31T23:59:59.999Z`
    );

    const [currentYearPayments, previousYearEarning] = await Promise.all([
      prisma.studentFees.findMany({
        where: {
          createdAt: {
            gte: currentYearStart,
            lte: currentYearEnd,
          },
          feesManagement: {
            subscriptionId,
          },
        },
        select: {
          createdAt: true,
          paidAmount: true,
        },
      }),

      prisma.studentFees.aggregate({
        where: {
          createdAt: {
            gte: previousYearStart,
            lte: previousYearEnd,
          },
          feesManagement: {
            subscriptionId,
          },
        },
        _sum: {
          paidAmount: true,
        },
      }),
    ]);

    const monthlyStats = Array.from({ length: 12 }, (_, index) => ({
      year,
      month: index + 1,
      amount: 0,
    }));

    currentYearPayments.forEach((payment) => {
      const month = payment.createdAt.getMonth();
      monthlyStats[month].amount += payment.paidAmount;
    });

    
    monthlyStats.forEach((item) => {
      item.amount = Number(item.amount.toFixed(2));
    });

    const currentYearTotal = monthlyStats.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const previousYearTotal =
      previousYearEarning._sum.paidAmount ?? 0;

    let yearlyGrowth = 0;

    if (previousYearTotal > 0) {
      yearlyGrowth =
        ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    } else if (currentYearTotal > 0) {
      yearlyGrowth = 100;
    }

    const result = {
      monthlyStats,
      yearlyGrowth: Number(yearlyGrowth.toFixed(2)),
      year,
      totalEarning: Number(currentYearTotal.toFixed(2)),
      previousYearTotal: Number(previousYearTotal.toFixed(2)),
    };

    await setCache(cacheKey, result, CACHE_TTL);

    return result;
  } catch (error) {
    throw catchError(error);
  }
};

const sectionAndClassesIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const { branchName } = query;

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(["classLevel", "roomNumber", "assignableSubject"])
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const whereCondition = {
      subscriptionId,
      ...(branchName ? { teacher: { branchName } } : {}),
      ...queryOptions.where,
    };

    const overviewWhere = {
      subscriptionId,
      ...(branchName ? { teacher: { branchName } } : {}),
    };

    const [classes, total, overview, totalEarning] = await Promise.all([
      prisma.classDistribution.findMany({
        where: whereCondition,
        orderBy: queryOptions.orderBy,
        skip: queryOptions.skip,
        take: queryOptions.take,
        select: {
          id: true,
          capacity: true,
          roomNumber: true,
          classLevel: true,
          assignableSubject: true,
          day: true,
          time: true,
          isOnline: true,
          teacher: {
            select: {
              id: true,
              teacherName: true,
              email: true,
              phoneNumber: true,
              branchName: true,
            },
          },
        },
      }),

      prisma.classDistribution.count({
        where: whereCondition,
      }),

      prisma.classDistribution.aggregate({
        where: overviewWhere,
        _sum: {
          capacity: true,
        },
        _count: {
          id: true,
        },
      }),

      prisma.paymentHistory.aggregate({
        _sum: { amount: true },
        where: {
          studentFees: {
            isDelete: false,
            student: {
              subscriptionId,
              ...(branchName ? { branchName } : {}),
            },
            feesManagement: { subscriptionId, isDelete: false },
          },
        },
      }),
    ]);

    // Total unique sections(room)
    const totalSections = await prisma.classDistribution.groupBy({
      by: ["roomNumber"],
      where: overviewWhere,
    });

    // Available Seats
    const enrolled = await prisma.student.count({
      where: {
        subscriptionId,
        ...(branchName ? { branchName } : {}),
      },
    });

    const totalCapacity = overview._sum.capacity ?? 0;
    const availableSeats = totalCapacity - enrolled;

    return {
      overview: {
        totalClasses: overview._count.id,
        totalCapacity,
        totalSections: totalSections.length,
        availableSeats,
        totalEarning: totalEarning._sum.amount ?? 0,
      },

      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
        totalPage: Math.ceil(total / (Number(query.limit) || 10)),
      },

      data: classes,
    };
  } catch (error) {
    throw catchError(error);
  }
};

const subjectIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const whereCondition: any = {
      subscriptionId,
      ...queryOptions.where,
    };

    // Global Search
    if (query.searchTerm) {
      whereCondition.OR = [
        {
          classLevel: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          roomNumber: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          assignableSubject: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          teacher: {
            teacherName: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          teacher: {
            branchAdmin: {
              assignBranch: {
                contains: query.searchTerm,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const [classes, total, overview] = await Promise.all([
      prisma.classDistribution.findMany({
        where: whereCondition,
        orderBy: queryOptions.orderBy,
        skip: queryOptions.skip,
        take: queryOptions.take,
        select: {
          id: true,
          capacity: true,
          roomNumber: true,
          classLevel: true,
          assignableSubject: true,
          day: true,
          time: true,
          isOnline: true,

          teacher: {
            select: {
              teacherId: true,
              teacherName: true,
              phoneNumber: true,

              branchAdmin: {
                select: {
                  assignBranch: true,
                },
              },
            },
          },
        },
      }),

      prisma.classDistribution.count({
        where: whereCondition,
      }),

      prisma.classDistribution.aggregate({
        where: whereCondition,
        _count: {
          id: true,
        },
        _sum: {
          capacity: true,
        },
      }),
    ]);

    return {
      overview: {
        totalClasses: overview._count.id,
        totalCapacity: overview._sum.capacity ?? 0,
      },

      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
        totalPage: Math.ceil(total / (Number(query.limit) || 10)),
      },

      data: classes,
    };
  } catch (error) {
    throw catchError(error);
  }
};


const findByAllExamAnnouncementIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const whereCondition: any = {
      subscriptionId,
      ...queryOptions.where,
    };

    delete whereCondition.classLevel;
    delete whereCondition.assignableSubject;
    delete whereCondition.roomNumber;
    delete whereCondition.isOnline;

    // Relation filters
    if (
      query.classLevel ||
      query.assignableSubject ||
      query.roomNumber ||
      query.isOnline !== undefined
    ) {
      whereCondition.classDistribution = {};

      if (query.classLevel) {
        whereCondition.classDistribution.classLevel = query.classLevel;
      }

      if (query.assignableSubject) {
        whereCondition.classDistribution.assignableSubject = {
          contains: query.assignableSubject,
          mode: "insensitive",
        };
      }

      if (query.roomNumber) {
        whereCondition.classDistribution.roomNumber = {
          contains: query.roomNumber,
          mode: "insensitive",
        };
      }

      if (query.isOnline !== undefined) {
        whereCondition.classDistribution.isOnline =
          query.isOnline === "true";
      }
    }

   
    if (query.searchTerm) {
      whereCondition.OR = [
        {
          examName: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          topic: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          instruction: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          classDistribution: {
            classLevel: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          classDistribution: {
            assignableSubject: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          classDistribution: {
            roomNumber: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const today = new Date();

    const [
      exams,
      total,
      completedExamCount,
      unCompletedExamCount,
      upcomingExamCount,
    ] = await Promise.all([
      prisma.examAnnouncement.findMany({
        where: whereCondition,
        orderBy: queryOptions.orderBy,
        skip: queryOptions.skip,
        take: queryOptions.take,
        select: {
          id: true,
          examDate: true,
          examName: true,
          topic: true,
          totalMarks: true,
          duration: true,
          instruction: true,
          isCompleted: true,

          classDistribution: {
            select: {
              classLevel: true,
              assignableSubject: true,
              roomNumber: true,
              isOnline: true,
            },
          },

          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.examAnnouncement.count({
        where: whereCondition,
      }),

      prisma.examAnnouncement.count({
        where: {
          subscriptionId,
          isCompleted: true,
        },
      }),

      prisma.examAnnouncement.count({
        where: {
          subscriptionId,
          isCompleted: false,
        },
      }),

      prisma.examAnnouncement.count({
        where: {
          subscriptionId,
          examDate: {
            gt: today,
          },
        },
      }),
    ]);

    return {
      overview: {
        totalExam: total,
        completedExam: completedExamCount,
        unCompletedExam: unCompletedExamCount,
        upcomingExam: upcomingExamCount,
      },

      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
        totalPage: Math.ceil(total / (Number(query.limit) || 10)),
      },

      data: exams,
    };
  } catch (error) {
    throw catchError(error);
  }
};


const allExamResultIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaRelationQueryBuilder(query)
      .search([
        "students.name",
        "students.studentId",
        "students.className",

        "teachers.teacherName",
        "teachers.teacherId",

        "examAnnouncement.examName",
        "examAnnouncement.topic",
      ])
      .filter()
      .sort()
      .paginate()
      .fields();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const result = await prisma.examGrades.findMany({
      where: {
        isDelete: false,

        examAnnouncement: {
          subscriptionId,
          isDelete: false,
        },

        ...where,
      },

      include: {
        students: {
          select: {
            id: true,
            name: true,
            studentId: true,
            className: true,
          },
        },

        teachers: {
          select: {
            id: true,
            teacherName: true,
            teacherId: true,
          },
        },

        examAnnouncement: {
          select: {
            id: true,
            examName: true,
            topic: true,
            examDate: true,
            totalMarks: true,
            duration: true,
          },
        },
      },

      orderBy,
      skip,
      take,
    });

    const total = await prisma.examGrades.count({
      where: {
        isDelete: false,

        examAnnouncement: {
          subscriptionId,
          isDelete: false,
        },

        ...where,
      },
    });

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.max(Number(query.limit) || 10, 1);

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
    throw catchError(error);
  }
};

const sdf=async()=>{

  console.log("dsahfklasjfkk;alsf asdkfasldkjfl;sajkfa sdkfljaslkdj")

 const result=  await prisma.subscriptionDetails.create({
    data:{
      subscriptionId:"0b2358e8-7b55-40c7-b62f-2759a8f826ca",
      area:"Urban",
      city:"Thakurgoan",
      country:"Bangladesh",
      schoolName:"Daffodil University",
      schoolType:"college",
      state:"Dhaka",
      studentLimit:"500",
      subscriptionType:"paid",
      schoolPhoto:"uploads/1783622404181-Staples_High_School,_Westport,_CT.jpg",

      
    }
   })
   await prisma.institutionBranch.create({
    data:{
      subscriptionDetailId:result.id,
      subscriptionId:"0b2358e8-7b55-40c7-b62f-2759a8f826ca",
      location:"Dhaka Bangladesh",
      name:"Commodi esse nostrum",
      type:"Primary School",
     
      userId:"aef705f9-6396-4fe1-b84f-f00cf71b578a",
      annualPriceUsd:500,
      contact:"01722305054"

      
    }

   })
   
   console.log(result)
   return result
}

const BranchManagementServices = {
  create_branch_admin_IntoDb,
   findSubscriptionBranchByIdIntoDb,
   login_branch_admin_IntoDb,
    findByAllBranchIntoDb,
     updateByBranchAdminIntoDb,
     deleteBranchAdminIntoDb ,
      findByAllBranchAdminIntoDb,
      changePasswordBranchAdminIntoDb,
      refreshTokenBranchAdminIntoDb,
      forgotPasswordBranchADminIntoDb,
      verificationForgotBranchAdminIntoDb,
       resetPasswordBranchAdminIntoDb,
       findInstitutionBranchOptionsIntoDb,
       findInstitutionBranchStatsIntoDb,
       findInstitutionBranchesIntoDb,
       createInstitutionBranchIntoDb,
       updateInstitutionBranchIntoDb,
       overrideInstitutionBranchPriceIntoDb,
       deleteInstitutionBranchIntoDb,
       branchManagementTotalCountIntoDb,
       studentGrowthIntoDb,
       earningGrowthIntoDb,
       sectionAndClassesIntoDb,
       subjectIntoDb,
       findByAllExamAnnouncementIntoDb,
       allExamResultIntoDb,
       sdf

};

export default BranchManagementServices;
