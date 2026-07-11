import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import SupportServices from "./support.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";



const sendSupportMessage:RequestHandler=catchAsync(async(req  , res)=>{

      const result=await SupportServices.sendSupportMessageIntoDb(req.user.id , req.user.role, req.user.subscriptionId,  req.body);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message:"Successfully Send Message",
      data: result,
    });

});

const  findByAllSupport: RequestHandler=catchAsync(async(req , res)=>{


    const result=await SupportServices.findByAllSupportIntoDb(req.query);
       sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:"Successfully Find By All Support",
      data: result,
    });
});


const deleteSupport:RequestHandler=catchAsync(async(req , res)=>{

    const result=await SupportServices.deleteSupportIntoDb(req.params.supportId);
     sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:result.message,
      data: result,
    });
})

const SupportController={
     sendSupportMessage,
      findByAllSupport,
      deleteSupport
};

export default SupportController;
