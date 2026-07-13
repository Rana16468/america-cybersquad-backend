import express, { NextFunction, Request, Response } from 'express';
import branchAdminAuth from '../../middlewares/branchAdminAuth';
import { UserRole } from '@prisma/client';
import { uploadFile } from '../../../helpars/fileUploader';
import ApiError from '../../../errors/ApiErrors';
import validateRequest from '../../middlewares/validateRequest';
import httpStatus from 'http-status';
import AssignmentValidation from './assignments.validation';
import AssignmentsController from './assignments.controller';
import auth from '../../middlewares/auth';

const router=express.Router();

router.post(
  "/create_assignment",
  branchAdminAuth(UserRole.TEACHER),

  

  uploadFile.attachmentFiles,

  (req: Request, _res: Response, next: NextFunction) => {
    try {
    
      if (req.body.data && typeof req.body.data === "string") {
        req.body = JSON.parse(req.body.data);
      }

      
      if (req.files && (req.files as any).attachments) {
        const files = (req.files as any).attachments;

        req.body.attachmentFiles = files.map((file: Express.Multer.File) =>
          uploadFile.toRelativePath(file.path)
        );
      }

      next();
    } catch (error: any) {
      next(new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON data"));
    }
  },

  validateRequest(AssignmentValidation.assignmentSchema),
  AssignmentsController.createAssignments
);

router.get("/find_by_specific_teacher_assignment", auth(UserRole.TEACHER), AssignmentsController.findBySpecificTeacherAssignment);
router.get("/find_by_specific_assignment/:id", auth(UserRole.TEACHER), AssignmentsController.findBySpecificAssignment);
router.patch("/update_teacher_assignment/:id", auth(UserRole.TEACHER),uploadFile.attachmentFiles,

  (req: Request, _res: Response, next: NextFunction) => {
    try {
    
      if (req.body.data && typeof req.body.data === "string") {
        req.body = JSON.parse(req.body.data);
      }

      
      if (req.files && (req.files as any).attachments) {
        const files = (req.files as any).attachments;

        req.body.attachmentFiles = files.map((file: Express.Multer.File) =>
          uploadFile.toRelativePath(file.path)
        );
      }

      next();
    } catch (error: any) {
      next(new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON data"));
    }
  }, validateRequest(AssignmentValidation.updateAssignmentSchema), AssignmentsController.updateClassTeacherAssignment);

  router.delete("/delete_class_assignment/:id", auth(UserRole.TEACHER), AssignmentsController.deleteClassAssignment);
 // Class Materials all features

router.post(
  "/create_class_materials",

  auth(UserRole.TEACHER),

  uploadFile.classMaterialFiles,

  async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {

      // ✅ Parse JSON data if exists
      if (req.body.data) {
        req.body =
          typeof req.body.data === "string"
            ? JSON.parse(req.body.data)
            : req.body.data;
      }

      // ✅ Handle upload.fields()
      if (req.files) {

        const files = req.files as {
          materialFiles?: Express.Multer.File[];
        };

        if (files.materialFiles?.length) {

          req.body.materialFiles =
            files.materialFiles.map((file) =>
              uploadFile.toRelativePath(file.path)
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
    AssignmentValidation.createClassMaterialSchema
  ),

  AssignmentsController.createClassMaterials
);

router.get("/find_by_specific_teacher_class_material/:classDistributionId", auth(UserRole.TEACHER), AssignmentsController.findBySpecificTeacherClassMaterials);
router.get("/find_by_specific_class_material/:id",auth(UserRole.TEACHER),AssignmentsController.findBySpecificClassMaterial);
router.patch("/update_specific_class_material/:id", 
  auth(UserRole.TEACHER),
uploadFile.classMaterialFiles,

  async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {

      // ✅ Parse JSON data if exists
      if (req.body.data) {
        req.body =
          typeof req.body.data === "string"
            ? JSON.parse(req.body.data)
            : req.body.data;
      }

      // ✅ Handle upload.fields()
      if (req.files) {

        const files = req.files as {
          materialFiles?: Express.Multer.File[];
        };

        if (files.materialFiles?.length) {

          req.body.materialFiles =
            files.materialFiles.map((file) =>
              uploadFile.toRelativePath(file.path)
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

validateRequest( AssignmentValidation.updateSpecificClassMaterialSchema), AssignmentsController.updateSpecificClassMaterial);

router.delete("/delete_class_materials/:id", 
  auth(UserRole.TEACHER), AssignmentsController.deleteClassMaterials);

router.get("/find_by_submitted_assignment_list/:classAssignmentId",
  auth(UserRole.TEACHER), 
  AssignmentsController.submittedAssignmentList
)



  


const AssignmentRouter=router;
export default AssignmentRouter;

