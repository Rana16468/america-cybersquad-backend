import express from "express";
import TeacherController from "./Teacher.controller";
import validateRequest from "../../middlewares/validateRequest";
import teacherValidation from "./Teacher.validation";

import { UserRole } from "@prisma/client";
import branchAdminAuth from "../../middlewares/branchAdminAuth";
import auth from "../../middlewares/auth";
import TeacherService from "./Teacher.services";



const router = express.Router();

router.post(    
    "/create-teacher",
    branchAdminAuth(UserRole.BRANCH_ADMIN),
    validateRequest(teacherValidation.TeacherSchema),
    TeacherController.createTeacher
);
router.get(
  "/find-specific-branch-all-teachers",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  TeacherController.findByAllTeachersBranchAdmin
);
router.get(
  "/find-single-teacher/:teacherId",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  TeacherController.findBySingleTeacher
);


router.patch(
  "/update-teacher/:teacherId",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  validateRequest(teacherValidation.TeacherUpdateSchema),
  TeacherController.updateTeacher
);

router.delete(
  "/delete-teacher/:teacherId",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  TeacherController.deleteTeacher
);

router.get(
  "/find-specific-institution-all-teachers",
  auth(UserRole.INSTITUTIONAL_OWNER),
  TeacherController.findByAllTeachers_Institutional_Owner
);

router.get("/find_by_specific_class_listOf_teacher", auth(UserRole.TEACHER), TeacherController.findBySpecificClassListOfTeacher);
router.get("/find_by_specific_student_listOf_teacher", auth(UserRole.TEACHER), TeacherController.findBySpecificStudentListOfTeachers); 
router.get("/find_by_specific_student_attendance_of_teacher/:classDistributionId", auth(UserRole.TEACHER), TeacherController.findBySpecificStudentAttendanceOfTeachers);  
router.post("/recorded_student_attendance_of_teacher", auth(UserRole.TEACHER), validateRequest(teacherValidation.recordAttendanceSchema), TeacherController.recordedStudentAttendanceOfTeachers); 
router.patch("/update_student_attendance_of_teacher", auth(UserRole.TEACHER), validateRequest(teacherValidation.updateRecordAttendanceSchema), TeacherController.updateStudentAttendanceOfTeachers);
router.get("/teacher_attendance_data/:subscriptionId", auth(UserRole.TEACHER), TeacherController.teacherAttendanceData);
router.post("/online_class_recorded_of_teacher", auth(UserRole.TEACHER), validateRequest(teacherValidation.onlineClassRecordedOfTeachersSchema), TeacherController.onlineClassRecordedOfTeachers);  
router.post("/store_class_recording_link_of_teacher", auth(UserRole.TEACHER), validateRequest(teacherValidation.storeClassRecordingLinkOfTeachersSchema), TeacherController.storeClassRecordingLinkOfTeachers);
router.get("/find_by_specific_student_class_recording_of_teacher", auth(UserRole.TEACHER), TeacherController.findBySpecificStudentClassRecordingOfTeachers); 
router.delete("/delete_class_recording_link_of_teacher/:recordingId" ,auth(UserRole.TEACHER), TeacherController.deleteClassRecordingLinkOfTeachers);

router.delete("/delete_attendance", TeacherService.deleteAllAttendanceIntoDb)







const TeacherRoute = router;
export default TeacherRoute;