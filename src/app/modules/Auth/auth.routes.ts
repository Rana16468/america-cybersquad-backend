import { UserRole } from "@prisma/client";
import express, { NextFunction, Request, Response } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { authValidation } from "./auth.validation";
import { uploadFile } from "../../../helpars/fileUploader";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import userValidation from "../User/user.validation";

const router = express.Router();

// login user
router.post("/login",validateRequest(authValidation.LoginSchema), AuthController.loginUser);
router.post("/refresh-token", validateRequest(authValidation.requestTokenValidationSchema), AuthController.refreshToken);
router.get("/my-profile", 
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER, UserRole.BRANCH_ADMIN, UserRole.STUDENT, UserRole.parent,UserRole.TEACHER, UserRole.NURSE),
   AuthController.myProfile);
//  updateUserZodSchema
router.patch(
  "/update_my_profile",
  auth(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.parent,
    UserRole.TEACHER,
    UserRole.INSTITUTIONAL_OWNER,
    UserRole.BRANCH_ADMIN,
    UserRole.NURSE
  ),
  uploadFile.profileImage,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.data && typeof req.body.data === "string") {
        req.body = JSON.parse(req.body.data);
      }
      next();
    } catch (error) {
      next(new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON data", ""));
    }
  },
  validateRequest( userValidation.updateUserZodSchema),
  AuthController.changeMyProfile
);

router.get(
  "/find_by_admin_all_users",
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN ),
  AuthController.findByAllUsersAdmin
);

router.delete( `/delete_account`, auth(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER, UserRole.BRANCH_ADMIN, UserRole.STUDENT, UserRole.parent,UserRole.TEACHER, UserRole.NURSE), AuthController.deleteAccount);

router.patch(
  "/block_unblock_user/:id",
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest(authValidation.blockUserZodSchema),
  AuthController.isBlockAccount
);


// // create user and login facebook and google
// router.post("/social-login", AuthController.socialLogin);

// // website login after booking
// router.post("/login-website", AuthController.loginWebsite);

// // refresh token
// router.post("/refresh-token", AuthController.refreshToken);



//change password
router.put(
  "/change-password",
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER, UserRole.BRANCH_ADMIN, UserRole.STUDENT, UserRole.parent,UserRole.TEACHER, UserRole.NURSE),
  validateRequest(authValidation.changePasswordValidationSchema),
  AuthController.changePassword
);

export const authRoutes = router;
