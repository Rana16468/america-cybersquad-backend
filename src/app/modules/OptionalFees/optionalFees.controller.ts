import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import OptionalFeesServices from "./optionalFees.services";


const createOptionalFees = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await OptionalFeesServices.createOptionalFeesIntoDb(req.body, req.user.subscriptionId);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Optional fees created successfully",
      data: result,
    });
  }
);

const findAllOptionalFees = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await OptionalFeesServices.findAllOptionalFeesIntoDb(req.user.subscriptionId, req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Optional fees retrieved successfully",
      data: result,
    });
  }
);

const findSingleOptionalFees = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await OptionalFeesServices.findSingleOptionalFeesIntoDb(
        req.params.id
      );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Optional fees retrieved successfully",
      data: result,
    });
  }
);

const updateOptionalFees = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await OptionalFeesServices.updateOptionalFeesIntoDb(
        req.params.id,
        req.body
      );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Optional fees updated successfully",
      data: result,
    });
  }
);

const deleteOptionalFees = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await OptionalFeesServices.deleteOptionalFeesIntoDb(
        req.params.id
      );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Optional fees deleted successfully",
      data: result,
    });
  }
);

export const OptionalFeesController = {
  createOptionalFees,
  findAllOptionalFees,
  findSingleOptionalFees,
  updateOptionalFees,
  deleteOptionalFees,
};