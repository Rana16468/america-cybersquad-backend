import { UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import httpStatus from "http-status";

import ApiError from "../../../errors/ApiErrors";

import prisma from "../../../shared/prisma";
import { ISignupRequest, RequestWithFile } from "./auth.interface";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import config from "../../../config";
import { JwtPayload } from "jsonwebtoken";
import catchError from "../../../errors/catchError";
import { uploadFile } from "../../../helpars/fileUploader";
import { logger } from "../../../config/logger";

import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { TUser } from "../User/user.interface";
import authConstants from "./auth.constant";

type AuthAccountSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  uiRole: string;
  schoolName?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  branches?: number | null;
  subscriptionId?: string | null;
};

type LoginCandidate = {
  id: string;
  password: string;
  email: string;
  role: string;
  subscriptionId?: string | null;
  profile: AuthAccountSummary;
};

const mapBackendRoleToUiRole = (role: string) => {
  switch (role) {
    case UserRole.INSTITUTIONAL_OWNER:
      return "institution_manager";
    case UserRole.ADMIN:
      return "branch_manager";
    case UserRole.BRANCH_ADMIN:
      return "branch_admin";
    case UserRole.TEACHER:
      return "teacher";
    case UserRole.STUDENT:
      return "student";
    case UserRole.parent:
      return "parent";
    case UserRole.NURSE:
      return "nurse";
    case UserRole.SUPER_ADMIN:
      return "super_admin";
    default:
      return String(role).toLowerCase();
  }
};

const buildTokenPayload = (candidate: LoginCandidate) => ({
  id: candidate.id,
  role: candidate.role,
  email: candidate.email,
  ...(candidate.subscriptionId ? { subscriptionId: candidate.subscriptionId } : {}),
});

const fetchLoginCandidate = async (
  email: string,
  role?: string
): Promise<LoginCandidate | null> => {
  const lookups = [
    async (): Promise<LoginCandidate | null> => {
      const user = await prisma.user.findFirst({
        where: {
          email,
          isVerified: true,
          status: UserStatus.ACTIVE,
          ...(role && {
            role: role as UserRole,
          }),
        },
        select: {
          id: true,
          password: true,
          email: true,
          role: true,
          name: true,
          schoolName: true,
          country: true,
          city: true,
          state: true,
          branches: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        password: user.password,
        email: user.email,
        role: user.role,
        profile: {
          id: user.id,
          name: user.name || user.schoolName || user.email,
          email: user.email,
          role: user.role,
          uiRole: mapBackendRoleToUiRole(user.role),
          schoolName: user.schoolName,
          country: user.country,
          city: user.city,
          state: user.state,
          branches: user.branches,
        },
      };
    },
    async (): Promise<LoginCandidate | null> => {
      if (role && role !== UserRole.BRANCH_ADMIN) {
        return null;
      }

      const user = await prisma.branchAdmin.findFirst({
        where: {
          emailAddress: email,
          isVerified: true,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          password: true,
          emailAddress: true,
          role: true,
          subscriptionId: true,
          fullName: true,
          assignBranch: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        password: user.password,
        email: user.emailAddress,
        role: user.role,
        subscriptionId: user.subscriptionId,
        profile: {
          id: user.id,
          name: user.fullName,
          email: user.emailAddress,
          role: user.role,
          uiRole: mapBackendRoleToUiRole(user.role),
          schoolName: user.assignBranch,
          branches: 1,
          subscriptionId: user.subscriptionId,
        },
      };
    },
    async (): Promise<LoginCandidate | null> => {
      if (role && role !== UserRole.TEACHER) {
        return null;
      }

      const user = await prisma.teacher.findFirst({
        where: {
          email,
          isVerified: true,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          password: true,
          email: true,
          role: true,
          subscriptionId: true,
          teacherName: true,
          branchName: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        password: user.password,
        email: user.email,
        role: user.role,
        subscriptionId: user.subscriptionId,
        profile: {
          id: user.id,
          name: user.teacherName,
          email: user.email,
          role: user.role,
          uiRole: mapBackendRoleToUiRole(user.role),
          schoolName: user.branchName,
          subscriptionId: user.subscriptionId,
        },
      };
    },
    async (): Promise<LoginCandidate | null> => {
      if (role && role !== UserRole.STUDENT) {
        return null;
      }

      const user = await prisma.student.findFirst({
        where: {
          email,
          isVerified: true,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          password: true,
          email: true,
          role: true,
          subscriptionId: true,
          name: true,
          branchName: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        password: user.password,
        email: user.email,
        role: user.role,
        subscriptionId: user.subscriptionId,
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          uiRole: mapBackendRoleToUiRole(user.role),
          schoolName: user.branchName,
          subscriptionId: user.subscriptionId,
        },
      };
    },
    async (): Promise<LoginCandidate | null> => {
      if (role && role !== UserRole.parent && role !== UserRole.NURSE) {
        return null;
      }

      const user = await prisma.staff.findFirst({
        where: {
          email,
          isVerified: true,
          status: UserStatus.ACTIVE,
          ...(role && {
            role,
          }),
        },
        select: {
          id: true,
          password: true,
          email: true,
          role: true,
          subscriptionId: true,
          name: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        password: user.password,
        email: user.email,
        role: user.role,
        subscriptionId: user.subscriptionId,
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          uiRole: mapBackendRoleToUiRole(user.role),
          subscriptionId: user.subscriptionId,
        },
      };
    },
  ];

  for (const lookup of lookups) {
    const candidate = await lookup();
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const loginUserIntoDb = async (payload: Partial<TUser>) => {
  try {
    if (!payload.email || !payload.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Email and password are required",
        "",
      );
    }

    const supportedRoles = new Set<string>([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.INSTITUTIONAL_OWNER,
      UserRole.BRANCH_ADMIN,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.parent,
      UserRole.NURSE,
    ]);

    if (payload.role && !supportedRoles.has(String(payload.role))) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user role", "");
    }

    const candidate = await fetchLoginCandidate(
      payload.email,
      payload.role as string | undefined
    );

    if (!candidate) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
    }

    const isPasswordMatched = await bcrypt.compare(
      payload.password as string,
      candidate.password
    );

    if (!isPasswordMatched) {
      throw new ApiError(httpStatus.FORBIDDEN, "Password not matched", "");
    }

    const jwtPayload = buildTokenPayload(candidate);

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
      user: candidate.profile,
    };
  } catch (error) {
    catchError(error);
    throw error;
  }
};

const refreshTokenIntoDb = async (token: string) => {
  try {
    if (!token) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "You are not authorized",
        ""
      );
    }

    const decoded = jwtHelpers.verifyToken(
      token,
      config.jwt_refresh_secret as string
    ) as JwtPayload;

    const { id, role } = decoded;

    let user: any = null;
    let email: string | null = null;

    // 🔁 Fetch user based on role
    switch (role) {
      case UserRole.SUPER_ADMIN:
      case UserRole.INSTITUTIONAL_OWNER:
      case UserRole.ADMIN:
        user = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
            status: true,
          },
        });
        email = user?.email;
        break;

      case UserRole.BRANCH_ADMIN:
        user = await prisma.branchAdmin.findUnique({
          where: { id },
          select: {
            id: true,
            emailAddress: true,
            role: true,
            isVerified: true,
            status: true,
          },
        });
        email = user?.emailAddress;
        break;

      case UserRole.STUDENT:
        user = await prisma.student.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
            status: true,
          },
        });

        console.log("student account ", user)
        email = user?.email;
        break;

      case UserRole.TEACHER:
        user = await prisma.teacher.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
            status: true,
          },
        });
        email = user?.email;
        break;

      case UserRole.NURSE:
      case UserRole.parent:
        user = await prisma.staff.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
            status: true,
          },
        });
        email = user?.email;
        break;

      default:
        throw new ApiError(httpStatus.FORBIDDEN, "Invalid user role", "");
    }

    // 🔒 Shared validation logic (no repetition)
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
    }

    if (!user.isVerified) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Please verify your account",
        ""
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(httpStatus.FORBIDDEN, "User access denied", "");
    }

    // 🔐 Shared token generation
    const accessToken = jwtHelpers.generateToken(
      {
        id: user.id,
        email,
        role: user.role,
      },
      config.jwt_access_secret as string,
      config.expires_in as string
    );

    return { accessToken };
  } catch (error) {
    catchError(error);
    throw error;
  }
};

const myProfileIntoDb = async (id: string, role: string) => {
  try {
    let user: any = null;

    switch (role) {
      case UserRole.SUPER_ADMIN:
      case UserRole.INSTITUTIONAL_OWNER:
      case UserRole.ADMIN:
        user = await prisma.user.findUnique({
          where: { id },
          select: {
            name: true,
            email: true,
            city: true, 
            country: true,
            state: true,
            isVerified: true,
            photo: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      case UserRole.BRANCH_ADMIN:
        user = await prisma.branchAdmin.findUnique({
          where: { id },
          select: {
            fullName: true,
            emailAddress: true,
            phoneNumber: true,
            assignBranch: true,
            isVerified: true,
            photo: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      case UserRole.STUDENT:
        user = await prisma.student.findUnique({
          where: { id },
          select: {
            name: true,
            email: true,
            isVerified: true,
            branchName: true,
            className: true,
            guardianName: true,
            guardianPhone: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      case UserRole.TEACHER:
        user = await prisma.teacher.findUnique({
          where: { id },
          select: {
            teacherName: true,
            email: true,
            phoneNumber: true,
            branchName: true,
            subject: true,
            assignClass: true,
            teacherId: true,
            address: true,
            isVerified: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      case UserRole.NURSE:
      case UserRole.parent:
        user = await prisma.staff.findUnique({
          where: { id },
          select: {
            name: true,
            email: true,
            role: true,
            
            phoneNumber: true,
            generateId: true,
            isVerified: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      default:
        throw new ApiError(httpStatus.FORBIDDEN, "Invalid user role", "");
    }

    // shared validation
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
    }

    if (!user.isVerified) {
      throw new ApiError(httpStatus.FORBIDDEN, "Please verify your account", "");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(httpStatus.FORBIDDEN, "User access denied", "");
    }

    return user;
  } catch (error) {
    catchError(error);
    throw error;
  }
};

interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  password?: string;

  phoneNumber?: string;
  city?: string;
  country?: string;
  address?: string;
  schoolName?: string;

  // Student
  className?: string;
  guardianName?: string;
  guardianPhone?: string;
}

const changeMyProfileIntoDb = async (
  req: RequestWithFile,
  id: string,
  role: string,
) => {
  try {
    const file = req.file;

    const {
      name,
      phoneNumber,
      city,
      country,
      address,
      schoolName,
      className,
      guardianName,
      guardianPhone,
    } = req.body as ProfileUpdatePayload;

    let photo: string | undefined;

    if (file) {
      const { secure_url } = (await uploadFile.uploadToCloudinary(file)) as any;
      photo = secure_url;
    }

    let user: any = null;

    switch (role) {
 
      case UserRole.SUPER_ADMIN:
      case UserRole.INSTITUTIONAL_OWNER:
      case UserRole.ADMIN: {
        const data = {
          ...(name && { name }),
          ...(phoneNumber && { phoneNumber }),
          ...(city && { city }),
          ...(country && { country }),
          ...(address && { address }),
          ...(schoolName && { schoolName }),
          ...(photo && { photo }),
        };

        user = await prisma.user.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            city: true,
            country: true,
            address: true,
            state: true,
            schoolName: true,
            isVerified: true,
            photo: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      }

 
      case UserRole.BRANCH_ADMIN: {
        const data = {
          ...(name && { fullName: name }),
          ...(phoneNumber && { phoneNumber }),
          ...(photo && { photo }),
        };

        user = await prisma.branchAdmin.update({
          where: { id },
          data,
          select: {
            id: true,
            fullName: true,
            emailAddress: true,
            phoneNumber: true,
            assignBranch: true,
            isVerified: true,
            photo: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      }

      case UserRole.STUDENT: {
        const data = {
          ...(name && { name }),
          ...(className && { className }),
          ...(guardianName && { guardianName }),
          ...(guardianPhone && { guardianPhone }),
          ...(photo && { photo }),
        };

        user = await prisma.student.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            branchName: true,
            className: true,
            guardianName: true,
            guardianPhone: true,
            isVerified: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      }

   
      case UserRole.TEACHER: {
        const data = {
          ...(name && { teacherName: name }),
          ...(phoneNumber && { phoneNumber }),
          ...(address && { address }),
          ...(photo && { photo }),
        };

        user = await prisma.teacher.update({
          where: { id },
          data,
          select: {
            id: true,
            teacherName: true,
            email: true,
            phoneNumber: true,
            branchName: true,
            subject: true,
            assignClass: true,
            teacherId: true,
            address: true,
            isVerified: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      }

      /**
       * NURSE / PARENT
       */
      case UserRole.NURSE:
      case UserRole.parent: {
        const data = {
          ...(name && { name }),
          ...(phoneNumber && { phoneNumber }),
          ...(photo && { photo }),
        };

        user = await prisma.staff.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phoneNumber: true,
            generateId: true,
            isVerified: true,
            photo: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      }

      default:
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Invalid user role",
          "",
        );
    }

    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "User not found",
        "",
      );
    }

    if (!user.isVerified) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Please verify your account",
        "",
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "User access denied",
        "",
      );
    }

    return {
      status: true,
      message: "Profile updated successfully",
      data: user,
    };
  } catch (error) {
    catchError(error);
    throw error;
  }
};


const findByAllUsersAdminIntoDb = async (query: Record<string, unknown>) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(authConstants.searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const { owner, typeOfOwner, branches } = query;

    // ✅ Build relation filter
    const questionFilter: any = {};

    if (owner !== undefined) {
      questionFilter.owner = owner === "true";
    }

    if (typeOfOwner) {
      questionFilter.typeOfOwner = typeOfOwner;
    }

    if (branches) {
      questionFilter.branches = Number(branches);
    }

    const result = await prisma.user.findMany({
      where: {
        ...queryOptions.where,

        // ✅ relation filter
        ...(Object.keys(questionFilter).length > 0 && {
          questions: {
            is: questionFilter, 
          },
        }),
      },
      

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        id: true,
        name: true,
        email: true,
        photo: true,
        country: true,
        city: true,
        schoolName: true,
        state: true,
        role: true,
        status: true,
        isVerified: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        branches: true,
      },
    });

    const total = await prisma.user.count({
      where: {
        ...queryOptions.where,
        ...(Object.keys(questionFilter).length > 0 && {
          questions: {
            is: questionFilter,
          },
        }),
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
  } catch (error: unknown) {
    throw error;
  }
};

const isBlockAccountIntoDb = async (
  id: string,
  payload: Partial<TUser>,
  userRole: string,
) => {
  try {
    let result: any = null;

    if (!payload.status) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Status is required", "");
    }

    const validStatuses = [
      UserStatus.ACTIVE,
      UserStatus.INACTIVE,
      UserStatus.REJECTED,
    ];

    if (!validStatuses.includes(payload.status as UserStatus)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status value", "");
    }

    switch (userRole) {
      case UserRole.ADMIN:
      case UserRole.INSTITUTIONAL_OWNER: {
        const user = await prisma.user.findUnique({
          where: { id, isVerified: true },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
        }

        result = await prisma.user.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }

      case UserRole.BRANCH_ADMIN: {
        const user = await prisma.branchAdmin.findUnique({
          where: { id, isVerified: true },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "Branch admin not found", "");
        }

        result = await prisma.branchAdmin.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }

      case UserRole.STUDENT: {
        const user = await prisma.student.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "Student not found", "");
        }

        result = await prisma.student.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }

      case UserRole.TEACHER: {
        const user = await prisma.teacher.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found", "");
        }

        result = await prisma.teacher.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }

      case  UserRole.NURSE: {
        const user = await prisma.staff.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "Staff not found", "");
        }

        result = await prisma.staff.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }

        case  UserRole.parent: {
        const user = await prisma.staff.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, "Staff not found", "");
        }

        result = await prisma.staff.update({
          where: { id },
          data: {
            status: payload.status as UserStatus,
          },
        });

        break;
      }


      default: {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Invalid role for blocking operation",
          "",
        );
      }
    }

    return {
      success: true,
      message: `User account ${
        payload.status === UserStatus.INACTIVE ? "blocked" : "activated"
      } successfully`,
      data: result,
    };
  } catch (error: unknown) {
    catchError(error, "Block account operation failed");
    throw error;
  }
};
const deleteAccountIntoDb = async (userId: string) => {
  try {
    return userId;

    //  const result = await prisma.user.delete({
    //   where:{
    //     id:userId
    //   }
    //  });

    //  if(!result){
    //   throw new ApiError(httpStatus.NOT_FOUND, "User not found", "");
    //  }

    //  return result;
  } catch (error: unknown) {
    catchError(error);
  }
};

const socialLogin = async (payload: any) => {
  return payload;
};

// website login before booking
const loginWebsite = async (payload: ISignupRequest) => {
  return payload;
};

// change password
const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      password: true,
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const isPasswordMatch: boolean = await bcrypt.compare(
    oldPassword,
    userData.password,
  );
  if (!isPasswordMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: "Password changed successfully",
  };
};

export const AuthServices = {
  loginUserIntoDb,
  refreshTokenIntoDb,
  myProfileIntoDb,
  changeMyProfileIntoDb,
  deleteAccountIntoDb,
  isBlockAccountIntoDb,
  socialLogin,
  loginWebsite,
  changePassword,
  findByAllUsersAdminIntoDb,
};
