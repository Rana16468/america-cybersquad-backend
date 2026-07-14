import e from "express";
import catchAsync from "../../../shared/catchAsync";
import TeacherService from "./Teacher.services";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import { RequestHandler } from "express-serve-static-core";
import { getRedisClient } from "../../../config/redis";



const createTeacher:RequestHandler = catchAsync(async (req, res) => {

    const result = await TeacherService.createTeacherIntoDb(req.user.id, req.body);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
        message:"Successfully Create Teacher",
        data: result,
    });
    } );


    const findByAllTeachersBranchAdmin:RequestHandler = catchAsync(async (req, res) => {

      const result = await TeacherService.findByAllTeachersBranchAdminIntoDb(req.user.id, req.query);
        sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
            message:"Successfully Get All Teachers",

            data: result,
        });
        } );


        const findBySingleTeacher:RequestHandler = catchAsync(async (req, res) => {

          const result = await TeacherService.findBySingleTeacherIntoDb(req.params.teacherId);
            sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
                
                
                
                message:"Successfully Get Teacher",

                data: result,
            });
            } );


            const updateTeacher:RequestHandler = catchAsync(async (req, res) => {    
               const result= await TeacherService.updateTeacherIntoDb(req.params.teacherId, req.body);
                sendResponse(res, {
                    statusCode: httpStatus.OK,
                    success: true,
                    message:"Successfully Update Teacher",
                    data: result
                });
            } );

            const deleteTeacher:RequestHandler = catchAsync(async (req, res) => {   
                const result= await TeacherService.deleteTeacherFromDb(req.params.teacherId);
                sendResponse(res, {
                    statusCode: httpStatus.OK,
                    success: true,
                    message: result.message,
                    data: result
                });
            } );


            const findByAllTeachers_Institutional_Owner:RequestHandler = catchAsync(async (req, res) => {

              const result = await TeacherService.findByAllTeachers_Institutional_OwnerIntoDb(req.user.subscriptionId, req.query);
                sendResponse(res, {
                    statusCode: httpStatus.OK,

                    success: true,
                    message:"Successfully Get All Teachers",
                    data: result,
                });
                });


                const findBySpecificClassListOfTeacher:RequestHandler = catchAsync(async (req, res) => {

                  const result = await TeacherService.findBySpecificClassListOfTeachersIntoDb(req.user.id, req.query);
                    sendResponse(res, {
                        statusCode: httpStatus.OK,
                        success: true,
                        message:"Successfully Get All Teachers",
                        data: result,
                    });
                    } );


         const findBySpecificStudentListOfTeachers:RequestHandler = catchAsync(async (req, res) => {

           const result = await TeacherService.findBySpecificStudentListOfTeachersIntoDb(req.user.id, req.query);

          sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message:"Successfully Get All Students",
              data: result,
          });
          } );


          const findBySpecificStudentAttendanceOfTeachers:RequestHandler = catchAsync(async (req, res) => {

           const result = await TeacherService.findBySpecificStudentAttendanceOfTeachersIntoDb(req.user.id, req.params.classDistributionId, req.query);
          sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message:"Successfully Get All Students Attendance",
              data: result,
          });
          } );

          const recordedStudentAttendanceOfTeachers:RequestHandler = catchAsync(async (req, res) => {

           const result = await TeacherService.recordedStudentAttendanceOfTeachersIntoDb(req.user.id, req.body);  
          sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message:"Successfully Recorded Student Attendance",
              data: result,
          });
          } );

          const  updateStudentAttendanceOfTeachers:RequestHandler = catchAsync(async (req, res) => {

           const result = await TeacherService.updateStudentAttendanceOfTeachersIntoDb(req.user.id, req.user.subscriptionId, req.body);  
          sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message:"Successfully Update Student Attendance",
              data: result,
          });
          } );


          const teacherAttendanceData:RequestHandler = catchAsync(async (req, res) => {

           
           const result = await TeacherService.teacherAttendanceDataIntoDb(req.user.id, req.params.subscriptionId, req.query);
          sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message:"Successfully Get Teacher Attendance Data",
              data: result,
          });
          } );


          const onlineClassRecordedOfTeachers:RequestHandler = catchAsync(async (req, res) => {

              const result = await TeacherService.onlineClassRecordedOfTeachersIntoDb(req.body, req.user.subscriptionId);
                sendResponse(res, {
                    statusCode: httpStatus.OK,
                    success: true,
                    message:"Successfully Recorded Online Class Of Teacher",
                    data: result,
                });
                } );


        const storeClassRecordingLinkOfTeachers:RequestHandler = catchAsync(async (req, res) => {

              const result = await TeacherService.storeClassRecordingLinkOfTeachersIntoDb(req.body);    
                sendResponse(res, {
                    statusCode: httpStatus.OK,
                    success: true,
                    message:"Successfully Store Class Recording Link Of Teacher",
                    data: result,
                });
                });


                const  findBySpecificStudentClassRecordingOfTeachers:RequestHandler = catchAsync(async (req, res) => {

                  const result = await TeacherService.findBySpecificStudentClassRecordingOfTeachersIntoDb(req.user.id, req.query);
                    sendResponse(res, { 
                        statusCode: httpStatus.OK,
                        success: true,
                        message:"Successfully Get Class Recording Link Of Teacher",
                        data: result,
                    });
                    } );

        
                
                    const deleteClassRecordingLinkOfTeachers:RequestHandler=catchAsync(async(req , res)=>{

                         const result=await TeacherService.deleteClassRecordingLinkOfTeachersIntoDb(req.params.recordingId);
                             sendResponse(res, { 
                        statusCode: httpStatus.OK,
                        success: true,
                        message:result.message,
                        data: result,
                    });
                    })










const TeacherController = {
  createTeacher,
   findByAllTeachersBranchAdmin,
   findBySingleTeacher,
   updateTeacher,
   deleteTeacher,
   findByAllTeachers_Institutional_Owner,
   findBySpecificClassListOfTeacher,
   findBySpecificStudentListOfTeachers,
   findBySpecificStudentAttendanceOfTeachers,
   recordedStudentAttendanceOfTeachers,
    updateStudentAttendanceOfTeachers,
    teacherAttendanceData,
    onlineClassRecordedOfTeachers,
    storeClassRecordingLinkOfTeachers,
    findBySpecificStudentClassRecordingOfTeachers,
    deleteClassRecordingLinkOfTeachers

};
export default TeacherController;