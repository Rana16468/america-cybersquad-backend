import express, { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import subscriptionValidation from "../subscription/subscription.validation";
import stripeController from "./stripe.controller";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { uploadFile } from "../../../helpars/fileUploader";

const route = express.Router();

route.post(
  "/create-checkout-session",
  auth(UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER),
   uploadFile.profileImage,

  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.data && typeof req.body.data === "string") {
        req.body = JSON.parse(req.body.data);
      }

      const file = req.file;

      if (
        file &&
        req.body.subscriptiondetails &&
        Array.isArray(req.body.subscriptiondetails)
      ) {
        // Only save uploads path
        const schoolPhoto = `uploads/${file.filename}`;

        req.body.subscriptiondetails = req.body.subscriptiondetails.map(
          (item: any) => ({
            ...item,
            schoolPhoto,
          })
        );
      }

      next();
    } catch (error) {
      next(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Invalid JSON data",
          ""
        )
      );
    }
  },

  validateRequest(subscriptionValidation.subscriptionsSchema),
  stripeController.createCheckoutSession
);

route.post("/webhook", stripeController.handleWebhook);

const stripeRoute = route;

export default stripeRoute;
