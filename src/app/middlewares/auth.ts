import { NextFunction, Request, Response } from "express";

import { Secret } from "jsonwebtoken";
import config from "../../config";

import { UserRole, UserStatus } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";
import { jwtHelpers } from "../../helpars/jwtHelpers";
import prisma from "../../shared/prisma";

type AuthUser = {
  id?: string;
  subscriptionId?: string | null;
};

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt_access_secret as Secret
      );

      // Check role authorization BEFORE hitting the database.
      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden!");
      }

      let user: AuthUser | null = null;

      switch (verifiedUser?.role) {
        case UserRole.ADMIN:
        case UserRole.INSTITUTIONAL_OWNER: {
          const branch = await prisma.institutionBranch.findFirst({
            where: { userId: verifiedUser.id },
            select: { userId: true, subscriptionId: true },
          });

          if (branch) {
            user = { id: branch.userId, subscriptionId: branch.subscriptionId };
          } else {
            const owner = await prisma.user.findFirst({
              where: { id: verifiedUser.id },
              select: {
                id: true,
                subscriptions: { select: { id: true } },
              },
            });

            user = {
              id: owner?.id,
              subscriptionId: owner?.subscriptions?.[0]?.id,
            };
          }
          break;
        }

        case UserRole.BRANCH_ADMIN: {
          user = await prisma.branchAdmin.findUnique({
            where: { id: verifiedUser.id },
            select: { id: true, subscriptionId: true },
          });
          break;
        }

        case UserRole.STUDENT: {
          user = await prisma.student.findUnique({
            where: { id: verifiedUser.id, isVerified: true },
            select: { id: true, subscriptionId: true },
          });
          break;
        }

        case UserRole.parent: {
          user = await prisma.staff.findUnique({
            where: {
              id: verifiedUser.id,
              isVerified: true,
              status: UserStatus.ACTIVE,
            },
            select: { id: true, subscriptionId: true },
          });
          break;
        }

        case UserRole.TEACHER: {
          user = await prisma.teacher.findUnique({
            where: {
              id: verifiedUser.id,
              isVerified: true,
              status: UserStatus.ACTIVE,
            },
            select: { id: true, subscriptionId: true },
          });
          break;
        }

        default: {
          throw new ApiError(httpStatus.FORBIDDEN, "Invalid role!");
        }
      }

      if (!user || !user.id) {
        throw new ApiError(httpStatus.NOT_FOUND, "This user is not found!");
      }

      req.user = { ...verifiedUser, ...user };

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default auth;