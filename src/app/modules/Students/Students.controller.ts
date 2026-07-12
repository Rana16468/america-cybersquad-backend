import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync"
import { CreateStudentDto } from "./Students.interface";
import StudentsService from "./Students.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";



const createStudent:RequestHandler = catchAsync(async (req, res) => {

    const result = await StudentsService.createStudentIntoDb(req.user.id, req.body as CreateStudentDto);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message:"Successfully Create Student",
      data: result,
    });
  } );


  const findByAllStudents:RequestHandler = catchAsync(async (req, res) => {

    const result = await StudentsService.findByAllStudentsIntoDb(req.user.id, req.user.role,  req.query);   
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:"Successfully Get All Students",
        data: result,
    });
    } );

    const findByAllStudents_Institutional_Owner:RequestHandler = catchAsync(async (req, res) => {

      const result = await StudentsService.findByAllStudents_Institutional_OwnerIntoDb(req.params.subscriptionId, req.query);
      sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message:"Successfully Get All Students",
          data: result,
      });
      } );  

      const deleteStudent:RequestHandler = catchAsync(async (req, res) => {

        const result = await StudentsService.deleteStudentFromDb(req.params.studentId); 
        sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: result.message,
          data:result
        });
        });



        const updateStudent:RequestHandler = catchAsync(async (req, res) => {

          const result = await StudentsService.updateStudentIntoDb(req.params.studentId, req.body); 
          sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: result.message,
            data:result
          });
          });

          const findMyAllClassList:RequestHandler=catchAsync(async(req , res)=>{

              const result=await StudentsService.findMyAllClassListIntoDb(req.user.id, req.query);
           sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully Find My All Class List",
            data:result
          });
          });

          const findMyClassAssignment:RequestHandler=catchAsync(async(req , res)=>{

             const result=await StudentsService.findMyClassAssignmentIntoDb(req.user.id, req.query);
                      sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully Find My All Class Assignment",
            data:result
          });
          });


    const submitAssignment:RequestHandler=catchAsync(async(req , res)=>{

       const result=await StudentsService.submitAssignmentIntoDb(req.user.id, req.body);
        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully Recorded",
            data:result
          });
    });

    const findBySpecifAssignment:RequestHandler=catchAsync(async(req , res)=>{


      const result=await StudentsService.findBySpecifAssignmentIntoDb(req.params.classAssignmentId, req.user.id);
       sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully find By Specific Assignment",
            data:result
          });
       });


       const updateAndAddAssignment:RequestHandler=catchAsync(async(req , res)=>{

       const result=await StudentsService.updateAndAddAssignmentIntoDb(req.params.uploadFileId, req.body);
       sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully Recorded",
            data:result
          });
       });

       const deleteSubmitAssignment:RequestHandler=catchAsync(async(req , res)=>{

        const result=await StudentsService.deleteSubmitAssignmentIntoDb(req.params.uploadFileId, req.user.id);
             sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully Delete",
            data:result
          });
       });


       const findMyClassSchedule:RequestHandler=catchAsync(async(req , res)=>{


          const result=await StudentsService.findMyClassScheduleIntoDb(req.user.id, req.params.subscriptionId, req.query);
           sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully  My Class Schedule List",
            data:result
          });
       });

       const findMyClassAttendanceHistory:RequestHandler=catchAsync(async(req , res)=>{

          const result=await StudentsService.findMyClassAttendanceHistoryIntoDb(req.user.id,req.params.subscriptionId, req.query );
          sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully  My  attendance History",
            data:result
          });
       });

       const findMyClassMaterial:RequestHandler=catchAsync(async(req , res)=>{

          const result=await StudentsService.findMyClassMaterialIntoDb(req.user.id,req.params.subscriptionId,req.query);
          sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Successfully My All Class  Material",
            data:result
          });
       })

          
      



          





  const StudentsController = {
    createStudent,
    findByAllStudents,
    findByAllStudents_Institutional_Owner,
    deleteStudent,
    updateStudent,
    findMyAllClassList,
    findMyClassAssignment,
    submitAssignment,
    findBySpecifAssignment,
    updateAndAddAssignment,
    deleteSubmitAssignment,
    findMyClassSchedule,
    findMyClassAttendanceHistory,
    findMyClassMaterial
    
    
    
  }
  export default StudentsController;