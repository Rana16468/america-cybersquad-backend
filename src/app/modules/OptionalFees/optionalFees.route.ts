import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { createOptionalFeesSchema, updateOptionalFeesSchema } from "./optionalFees.validation";
import { OptionalFeesController } from "./optionalFees.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";


const router = express.Router();

router.post(
  "/",
  auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN),
  validateRequest(createOptionalFeesSchema),
  OptionalFeesController.createOptionalFees
);

router.get(
  "/",
  auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN),
  OptionalFeesController.findAllOptionalFees
);

router.get(
  "/:id",
  auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN),
  OptionalFeesController.findSingleOptionalFees
);

router.patch(
  "/:id",
  auth(UserRole.BURSAR, UserRole.BRANCH_ADMIN),
  validateRequest(updateOptionalFeesSchema),
  OptionalFeesController.updateOptionalFees
);

router.delete(
  "/:id",
  OptionalFeesController.deleteOptionalFees
);

const OptionalFeesRoutes = router;
export default OptionalFeesRoutes