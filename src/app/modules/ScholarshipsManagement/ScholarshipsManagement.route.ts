
import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import ScholarshipsManagementValidation from './ScholarshipsManagement.validation';
import ScholarshipsManagementController from './ScholarshipsManagement.controller';

const router=express.Router();

router.post("/added_scholarships", 
      auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN), 
validateRequest(ScholarshipsManagementValidation.createScholarshipsManagementSchema),
ScholarshipsManagementController.createScholarshipsManagement
);

router.get("/find_by_all_scholarships_student_list",
      
       auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN), 
       ScholarshipsManagementController.findByAllScholarshipsStudentList
      
);

router.get("/find_by_specific_scholarships/:id",
       auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN), 
       ScholarshipsManagementController.findBySpecificScholarshipsStudentList
);

router.patch("/update_scholarships_management/:id",
      auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN), 
      validateRequest(ScholarshipsManagementValidation.updateScholarshipsManagementSchema),
      ScholarshipsManagementController.updateScholarshipsManagement
);

router.delete("/delete_scholarships_management/:id", 
      auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN), 
      ScholarshipsManagementController.deleteScholarshipsManagement
)






const ScholarshipsManagementRouter=router
export default ScholarshipsManagementRouter