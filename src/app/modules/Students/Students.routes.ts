import z from "zod";
import { NextFunction, Request, Response, Router } from "express";

import studentValidation from "./Students.validation";
import validateRequest from "../../middlewares/validateRequest";    
import StudentsController from "./Students.controller";
import branchAdminAuth from "../../middlewares/branchAdminAuth";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { uploadFile } from "../../../helpars/fileUploader";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";



const router = Router();

router.post(
  "/create-student",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  validateRequest(studentValidation.createStudentZodSchema),
  StudentsController.createStudent,
);

router.get(
  "/find-specific-branch-all-students",
  branchAdminAuth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),

  StudentsController.findByAllStudents
);

router.get(
  "/find-specific-institution-all-students/:subscriptionId",
  auth(UserRole.INSTITUTIONAL_OWNER),
  StudentsController.findByAllStudents_Institutional_Owner
);


router.delete(
  "/delete-student/:studentId",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  StudentsController.deleteStudent
);

router.patch(
  "/update-student/:studentId",
  branchAdminAuth(UserRole.BRANCH_ADMIN),
  validateRequest(studentValidation.updateStudentZodSchema),
  StudentsController.updateStudent
);

router.get("/find_my_all_class_list", branchAdminAuth(UserRole.STUDENT),StudentsController.findMyAllClassList);
router.get("/find_my_class_assignment",branchAdminAuth(UserRole.STUDENT), StudentsController.findMyClassAssignment);
// ================================
// Students.routes.ts
// ================================

router.patch(
  "/submit-assignment",

  branchAdminAuth(UserRole.STUDENT),

  uploadFile.fileUrlFiles,

  async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      // parse multipart form-data json
      if (req.body.data) {
        req.body =
          typeof req.body.data === "string"
            ? JSON.parse(req.body.data)
            : req.body.data;
      }

      // uploaded files
      if (req.files) {
        const files = req.files as {
          fileUrl?: Express.Multer.File[];
        };

        if (files.fileUrl?.length) {
          req.body.uploadFiles = files.fileUrl.map(
            (file) => ({
              fileUrl:
                uploadFile.toRelativePath(file.path),
            })
          );
        }
      }

      next();
    } catch (error) {
      next(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Invalid JSON data"
        )
      );
    }
  },

  validateRequest(
    studentValidation.submitAssignmentSchema
  ),

  StudentsController.submitAssignment
);
router.get("/find_by_specif_assignment/:classAssignmentId", auth(UserRole.STUDENT), StudentsController.findBySpecifAssignment);



router.patch("/update_and_add_assignment/:uploadFileId",
   auth(UserRole.STUDENT),
  uploadFile.fileUrlFiles,
  async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      // parse multipart form-data json
      if (req.body.data) {
        req.body =
          typeof req.body.data === "string"
            ? JSON.parse(req.body.data)
            : req.body.data;
      }

      // uploaded files
      if (req.files) {
        const files = req.files as {
          fileUrl?: Express.Multer.File[];
        };

        if (files.fileUrl?.length) {
          req.body.uploadFiles = files.fileUrl.map(
            (file) => ({
              fileUrl:
                uploadFile.toRelativePath(file.path),
            })
          );
        }
      }

      next();
    } catch (error) {
      next(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Invalid JSON data"
        )
      );
    }
  },

validateRequest(studentValidation.updateAssignmentSchema), StudentsController.updateAndAddAssignment);

router.delete("/delete_submit_assignment/:uploadFileId", auth(UserRole.STUDENT),StudentsController.deleteSubmitAssignment)


router.get("/find_my_class_schedule/:subscriptionId", auth(UserRole.STUDENT),StudentsController.findMyClassSchedule);
router.get("/find_my_class_attendance_history/:subscriptionId", 
   auth(UserRole.STUDENT), 
   StudentsController.findMyClassAttendanceHistory
);

router.get("/find_my_class_material/:subscriptionId",auth(UserRole.STUDENT), StudentsController.findMyClassMaterial);


const  studentRoute=router;
export default studentRoute;