import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import FeesManagementServices from "./fees_management.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";


const recordedFeesManagement:RequestHandler=catchAsync(async(req , res)=>{


     const result=await  FeesManagementServices.recordedFeesManagementIntoDb( req.body);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });
});

const findByFeesManagement:RequestHandler=catchAsync(async(req , res)=>{

  const result=await FeesManagementServices.findByFeesManagementIntoDb(req.user.subscriptionId, req.query);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });

});

const updateFeesManagement:RequestHandler=catchAsync(async(req , res)=>{


    const result=await FeesManagementServices.updateFeesManagementIntoDb(req.params.feesManagementId, req.body);
     sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });
});


const  findBySpecificFeesManagement:RequestHandler=catchAsync(async(req , res)=>{

   const result=await FeesManagementServices.findBySpecificFeesManagementIntoDb(req.params.feesManagementId);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By Specific Fees Management",
    data: result,
  });
});


const studentFeesManuallyReceived:RequestHandler=catchAsync(async(req , res)=>{

   const result=await FeesManagementServices.studentFeesManuallyReceivedIntoDb(req.body);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });
});

const findByAllPayableFees:RequestHandler=catchAsync(async(req , res)=>{

    const result=await FeesManagementServices. findByAllPayableFeesIntoDb(req.user.subscriptionId, req.query);

      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find All Payable Fees",
    data: result,
  });

});

const  updateFeesManuallyReceived:RequestHandler=catchAsync(async(req , res)=>{


   const result=await FeesManagementServices.updateFeesManuallyReceivedIntoDb(req.params.id, req.body);
     sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });

});


const  findBySpecificFeesManuallyReceived:RequestHandler=catchAsync(async(req , res)=>{

   const result=await FeesManagementServices.findBySpecificFeesManuallyReceivedIntoDb(req.params.id);
   sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By Specific Fees Manually",
    data: result,
  });
});


const deleteFeesManuallyReceived:RequestHandler=catchAsync(async(req , res)=>{
   const result=await FeesManagementServices.deleteFeesManuallyReceivedIntoDb(req.params.id);
   sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });
});


const allBranchSpecificEarningManagement:RequestHandler=catchAsync(async(req , res)=>{

  console.log({sb: req.user})

    const result=await FeesManagementServices.allBranchSpecificEarningManagementIntoDb("0b2358e8-7b55-40c7-b62f-2759a8f826ca");
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find My All Earning",
    data: result,
  });
    
});

const  findBySpecificStudentFeesList:RequestHandler=catchAsync(async(req , res)=>{

   const result=await FeesManagementServices.findBySpecificStudentFeesListIntoDb(req.user.id);

sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find My  Fees List",
    data: result,
  });
})


const FeesManagementController={
    recordedFeesManagement,
    findByFeesManagement,
    updateFeesManagement,
    findBySpecificFeesManagement,
    studentFeesManuallyReceived,
    findByAllPayableFees,
      updateFeesManuallyReceived,
       findBySpecificFeesManuallyReceived,
       deleteFeesManuallyReceived,
       allBranchSpecificEarningManagement,
       findBySpecificStudentFeesList
};

export default FeesManagementController;


