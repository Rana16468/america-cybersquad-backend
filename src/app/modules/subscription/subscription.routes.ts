import express, { NextFunction, Request, Response } from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';

import subscriptionController from './subscription.controller';
import subscriptionValidation from './subscription.validation';
import { uploadFile } from '../../../helpars/fileUploader';
import ApiError from '../../../errors/ApiErrors';
import httpStatus from 'http-status';



const route=express.Router();


route.post(
  "/buy_the_subscription",
  auth(UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER),
  uploadFile.profileImage,

  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse FormData JSON
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

  subscriptionController.saveUserSubscription
);


route.get("/find_by_all_subscription", auth(UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER),subscriptionController.findByAllSubscriptionsAdmin );
route.delete("/delete_subscription/:subscriptionId", subscriptionController.hardDeleteSubscriptionById );
route.get("/find_my_all_subscription",
   auth(UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER), 
   subscriptionController.findMyAllSubscriptions )
route.get("/my_payment_status", auth(UserRole.ADMIN, UserRole.INSTITUTIONAL_OWNER), subscriptionController.findMyPaymentStatus)
route.get("/find_by_all_country_list",subscriptionController.allCountryList);
route.get("/all_school_list", subscriptionController.allSchoolList)
const subscriptionRoute=route;

export default subscriptionRoute
