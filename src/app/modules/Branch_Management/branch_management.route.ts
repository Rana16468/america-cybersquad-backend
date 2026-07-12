

import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import branchManagementValidation from './branch_management.validation';
import BranchManagementController from './branch_management.controller';
import branchAdminAuth from '../../middlewares/branchAdminAuth';

const route=express.Router();
route.post("/create_branch_admin", auth(UserRole.INSTITUTIONAL_OWNER),validateRequest( branchManagementValidation.createBranchAdminValidation),BranchManagementController.create_branch_admin );
route.get("/find_by_subscription_branch/:subscriptionId", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.findSubscriptionBranchById);
route.post("/login_branch_admin", validateRequest( branchManagementValidation.branchAdminLoginSchema), BranchManagementController.login_branch_admin);
route.get("/find_my_all_branch_admin", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.findByAllBranches);
route.patch("/update_branch_admin/:id", auth(UserRole.INSTITUTIONAL_OWNER), validateRequest( branchManagementValidation.updateBranchAdminValidation), BranchManagementController.updateByBranchAdmin);
route.delete("/delete_branch_admin/:id", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.deleteBranchAdmin);
// admin route ---- admin display the all  institutional owner branch admin and also update and delete the branch admin by id and also find the branch admin by subscription id and also login the branch admin by email and password
route.get("/find_all_branch_admin", auth(UserRole.ADMIN, UserRole.SUPER_ADMIN), BranchManagementController.findByAllBranchAdmin);
route.patch("/change_password_branch_admin",  branchAdminAuth(UserRole.BRANCH_ADMIN), validateRequest( branchManagementValidation.changePasswordValidationSchema), BranchManagementController.changePasswordBranchAdmin);
route.post("/refresh_token_branch_admin", validateRequest( branchManagementValidation.requestTokenValidationSchema), BranchManagementController.refreshTokenBranchAdmin);
route.post("/forgot_password_branch_admin", validateRequest( branchManagementValidation. branchAdminForgotPasswordValidationSchema), BranchManagementController.forgotPasswordBranchADmin); 
route.post("/verification_forgot_branch_admin", validateRequest( branchManagementValidation.branchAdminVerificationCodeSchema), BranchManagementController.verificationForgotBranchAdmin);  
route.post("/reset_password_branch_admin", validateRequest( branchManagementValidation.resetPasswordBrachAdminSchema), BranchManagementController.resetPasswordBranchAdmin);     
route.get("/institution_branch_options", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.findInstitutionBranchOptions);
route.get("/institution_branch_stats",
        auth(UserRole.INSTITUTIONAL_OWNER),
         BranchManagementController.findInstitutionBranchStats);
route.get("/institution_branches", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.findInstitutionBranches);
route.post("/institution_branches", auth(UserRole.INSTITUTIONAL_OWNER), validateRequest(branchManagementValidation.createInstitutionBranchValidation), BranchManagementController.createInstitutionBranch);
route.patch("/institution_branches/:id", auth(UserRole.INSTITUTIONAL_OWNER), validateRequest(branchManagementValidation.updateInstitutionBranchValidation), BranchManagementController.updateInstitutionBranch);
route.patch("/institution_branches/:id/override_price", auth(UserRole.INSTITUTIONAL_OWNER), validateRequest(branchManagementValidation.overrideInstitutionBranchPriceValidation), BranchManagementController.overrideInstitutionBranchPrice);

route.delete("/institution_branches/:id", auth(UserRole.INSTITUTIONAL_OWNER), BranchManagementController.deleteInstitutionBranch);


route.get("/branch_management_total_count/:subscriptionId",
       auth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),
      BranchManagementController.branchManagementTotalCount);

      route.get("/student_growth", 
              auth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),
            BranchManagementController.studentGrowth);

      route.get("/earning_growth",
             auth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),
            BranchManagementController.earningGrowth);

     route.get("/section_and_classes",
       auth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),
       BranchManagementController.sectionAndClasses

     );

     route.get("/find_by_all_subject",
        auth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER), 
       BranchManagementController.subject)

            
const branchManagement=route;

export default  branchManagement;

