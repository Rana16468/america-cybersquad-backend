import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import ScholarshipsManagementServices from "./ScholarshipsManagement.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";



const createScholarshipsManagement:RequestHandler=catchAsync(async(req , res)=>{

      const result=await ScholarshipsManagementServices.createScholarshipsManagementIntoDb(req.body, req.user.subscriptionId);
       sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Recorded",
    data: result,
  });

});

const findByAllScholarshipsStudentList:RequestHandler=catchAsync(async(req , res)=>{

        const result= await ScholarshipsManagementServices.findByAllScholarshipsStudentListIntoDb( req.user.subscriptionId, req.query);
         sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Find ScholarshipsStudent List",
    data: result,
  });

});

const findBySpecificScholarshipsStudentList:RequestHandler=catchAsync(async(req , res)=>{

       const result=await ScholarshipsManagementServices.findBySpecificScholarshipsStudentListIntoDb(req.params.id);
        sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Find By Specific ScholarshipsStudent List",
    data: result,
  });
});

const updateScholarshipsManagement:RequestHandler=catchAsync(async(req , res)=>{

       const result=await ScholarshipsManagementServices.updateScholarshipsManagementIntoDb(req.params.id, req.body);
        sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Find By Specific ScholarshipsStudent List",
    data: result,
  });
});

const deleteScholarshipsManagement:RequestHandler=catchAsync(async(req , res)=>{

      const result=await ScholarshipsManagementServices.deleteScholarshipsManagementIntoDb(req.params.id);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Delete",
    data: result,
  });
})





const ScholarshipsManagementController={

      createScholarshipsManagement,
      findByAllScholarshipsStudentList,
      findBySpecificScholarshipsStudentList,
      updateScholarshipsManagement,
      deleteScholarshipsManagement
}
export default ScholarshipsManagementController;