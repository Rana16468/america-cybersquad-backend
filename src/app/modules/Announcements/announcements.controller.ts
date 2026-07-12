import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import AnnouncementsServices from "./announcements.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";



const sendAnnouncements:RequestHandler=catchAsync(async(req , res)=>{

    const token = req.headers.authorization;

if (!token) {
  throw new ApiError(httpStatus.UNAUTHORIZED, "Authorization token missing");
}

const result = await AnnouncementsServices.sendAnnouncementsIntoDb(
  req.body,
  token
);

      sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Send Notification",
    data: result,
  });


});


const findByAnnouncement:RequestHandler=catchAsync(async(req , res)=>{

   const token = req.headers.authorization;

   if (!token) 
    {throw new ApiError(httpStatus.UNAUTHORIZED, "Authorization token missing");}
   const result=await AnnouncementsServices.findByAnnouncementIntoDb(req.query, token);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By All Announcement",
    data: result,
  });

});

const  findAllAnnouncement: RequestHandler=catchAsync(async(req , res)=>{

    const result=await AnnouncementsServices.findAllAnnouncementIntoDb(req.query);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By All Announcement",
    data: result,
  });
});


const  findBySpecificAnnouncements:RequestHandler=catchAsync(async(req , res)=>{

    const result=await AnnouncementsServices.findBySpecificAnnouncementsIntoDb(req.params.announcementId);
   sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By Specific Announcements",
    data: result,
  });

});

const  updateAnnouncement:RequestHandler=catchAsync(async(req , res)=>{

  const result=await AnnouncementsServices. updateAnnouncementIntoDb(req.params.announcementId, req.body, req.user.subscriptionId);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Update Announcements",
    data: result,
  });

});


const deleteAnnouncements:RequestHandler=catchAsync(async(req , res)=>{

    const result=await AnnouncementsServices.deleteAnnouncementsIntoDb(req.params.announcementId);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });

})



const AnnouncementsController={
    sendAnnouncements,
    findByAnnouncement,
     findAllAnnouncement,
     findBySpecificAnnouncements,
     updateAnnouncement,
     deleteAnnouncements
};

export default AnnouncementsController;

