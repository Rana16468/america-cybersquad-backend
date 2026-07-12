import { NextFunction, Request, Response } from "express";
import { Secret } from "jsonwebtoken";
import config from "../../config";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";
import { jwtHelpers } from "../../helpars/jwtHelpers";
import prisma from "../../shared/prisma";
import { UserRole, UserStatus } from "@prisma/client";

const branchAdminAuth = (...roles: string[]) => {
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

      // ✅ handle "Bearer token"
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

      

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt_access_secret as Secret
      );

      let user;

      switch (verifiedUser?.role) {
        case UserRole.ADMIN:
        case UserRole.INSTITUTIONAL_OWNER: {
          user = await prisma.user.findUnique({
            where: {
              id: verifiedUser.id,
              isVerified: true,
              status: UserStatus.ACTIVE,
            }
          });

          
          break;
        }

        case UserRole.BRANCH_ADMIN: {
          user = await prisma.branchAdmin.findUnique({
            where: { id: verifiedUser.id },
            select: { id: true , subscriptionId: true},
          });
          break;
        }
        case UserRole.STUDENT: {

          user=await prisma.student.findUnique({
            where:{id:verifiedUser.id, isVerified:true},
            select:{id:true, subscriptionId:true}
          });

        }break;

        case UserRole.parent: {

          user=await prisma.staff.findUnique({
            where:{id:verifiedUser.id},
            select:{id:true, subscriptionId:true}
          });

        }break; 

        
       case UserRole.TEACHER: {

          user=await prisma.teacher.findUnique({
            where:{id:verifiedUser.id, isVerified:true, status:UserStatus.ACTIVE},
            
            select:{id:true,subscriptionId: true ,subscriptions:{
              select: {
                id: true
              }
            }}
          }); 
          break;
        }
        
        
        default: {
          throw new ApiError(httpStatus.FORBIDDEN, "Invalid role!");
        }
      }

    
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "This user is not found!");
      }

      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden!");
      }

      req.user = verifiedUser;

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default branchAdminAuth;