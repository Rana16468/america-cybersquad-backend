import { RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import BranchManagementServices from "./branch_management.services";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import config from "../../../config";



const  create_branch_admin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.create_branch_admin_IntoDb(req.user.id, req.body);

    sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully  Recorded Branch Admin",
    data: result,
  });

});


const findSubscriptionBranchById:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.findSubscriptionBranchByIdIntoDb(req.user.id, req.params.subscriptionId);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Find By All Branches",
    data: result,
  });

});


const  login_branch_admin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.login_branch_admin_IntoDb(req.body);  

      const { accessToken, refreshToken } = result;
      
        res.cookie("refreshToken", refreshToken, {
          secure: config.env === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });

    sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Successfully Login Branch Admin",
    data: {
      accessToken
    },
  });
});


const findByAllBranches:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.findByAllBranchIntoDb(req.user.id, req.query); 

    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By All Branches",
    data: result,
  });
  });



  const updateByBranchAdmin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.updateByBranchAdminIntoDb( req.params.id, req.body,req.user.id);  
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Updated Branch Admin",
    data: result,
  });
});


const deleteBranchAdmin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.deleteBranchAdminIntoDb( req.params.id,req.user.id);  
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Deleted Branch Admin",
    data: result,
  });
});


const findByAllBranchAdmin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.findByAllBranchAdminIntoDb( req.query); 
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By All Branch Admins",
    data: result,
  });
});


const changePasswordBranchAdmin:RequestHandler=catchAsync(async(req , res)=>{

      const result=await BranchManagementServices.changePasswordBranchAdminIntoDb( req.user.id,req.body);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Changed Password Branch Admin",
    data: result,
  });
});

  
const refreshTokenBranchAdmin: RequestHandler = catchAsync(
  async (req, res) => {
    // ✅ 1. Safely get token
    const token = req.cookies?.refreshToken;

    // ✅ 2. Validate BEFORE service call
    if (!token) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus.UNAUTHORIZED,
        message: "No refresh token provided",
        data: null,
      });
    }

    // ✅ 3. Call service AFTER validation
    const result =
      await BranchManagementServices.refreshTokenBranchAdminIntoDb(token);

    // ✅ 4. Send success response
    return sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Token refreshed successfully",
      data: result,
    });
  }
);


const forgotPasswordBranchADmin: RequestHandler = catchAsync(
  async (req, res) => {
     const result = await BranchManagementServices.forgotPasswordBranchADminIntoDb(req.body.emailAddress);  
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "If the email exists, a password reset link has been sent",
    data: result,
  });
  });


  const verificationForgotBranchAdmin: RequestHandler = catchAsync( async (req, res) => {

      const result = await BranchManagementServices.verificationForgotBranchAdminIntoDb(req.body.verificationCode);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "OTP verified successfully. You can now reset your password.",
    data: result,
  });
  }
);

const  resetPasswordBranchAdmin: RequestHandler = catchAsync( async (req, res) => {

      const result = await BranchManagementServices.resetPasswordBranchAdminIntoDb(req.body);
      sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Password reset successfully.",
    data: result,
  });
});

const findInstitutionBranchOptions: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.findInstitutionBranchOptionsIntoDb(req.user.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully fetched institution branch options",
    data: result,
  });
});

const findInstitutionBranchStats: RequestHandler = catchAsync(async (req, res) => {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const result = await BranchManagementServices.findInstitutionBranchStatsIntoDb(req.user.id, branchId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully fetched institution branch stats",
    data: result,
  });
});

const findInstitutionBranches: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.findInstitutionBranchesIntoDb(req.user.id, req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully fetched institution branches",
    data: result,
  });
});

const createInstitutionBranch: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.createInstitutionBranchIntoDb(req.user.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Institution branch created successfully",
    data: result,
  });
});

const updateInstitutionBranch: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.updateInstitutionBranchIntoDb(req.user.id, req.params.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Institution branch updated successfully",
    data: result,
  });
});

const overrideInstitutionBranchPrice: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.overrideInstitutionBranchPriceIntoDb(req.user.id, req.params.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Institution branch price updated successfully",
    data: result,
  });
});

const deleteInstitutionBranch: RequestHandler = catchAsync(async (req, res) => {
  const result = await BranchManagementServices.deleteInstitutionBranchIntoDb(req.user.id, req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Institution branch deleted successfully",
    data: result,
  });
});


const branchManagementTotalCount:RequestHandler=catchAsync(async(req , res)=>{
  const result=await BranchManagementServices.branchManagementTotalCountIntoDb(req.params.subscriptionId);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find All Information",
    data: result,
  });
});

const studentGrowth:RequestHandler=catchAsync(async(req , res)=>{
   const result=await BranchManagementServices.studentGrowthIntoDb(req.params.subscriptionId, req.query);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find  By Student Growth",
    data: result,
  });
});

const earningGrowth:RequestHandler=catchAsync(async(req , res)=>{

   const result=await BranchManagementServices.earningGrowthIntoDb(req.params.subscriptionId, req.query);
   sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find  By earning growth Growth",
    data: result,
  });
});

const sectionAndClasses:RequestHandler=catchAsync(async(req , res)=>{

   const result=await BranchManagementServices.sectionAndClassesIntoDb(req.user.subscriptionId, req.query);
sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By Section And Classes",
    data: result,
  });

});

const subject:RequestHandler=catchAsync(async(req , res)=>{

    const result=await BranchManagementServices.subjectIntoDb(req.user.subscriptionId, req.query);
    sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Successfully Find By All Subject",
    data: result,
  });
})



  
            




const BranchManagementController={
    create_branch_admin,
    findSubscriptionBranchById,
    login_branch_admin,
    findByAllBranches,
    updateByBranchAdmin,
    deleteBranchAdmin,
    findByAllBranchAdmin,
    changePasswordBranchAdmin,
    refreshTokenBranchAdmin,
    forgotPasswordBranchADmin,
    verificationForgotBranchAdmin,
     resetPasswordBranchAdmin,
     findInstitutionBranchOptions,
     findInstitutionBranchStats,
     findInstitutionBranches,
     createInstitutionBranch,
     updateInstitutionBranch,
     overrideInstitutionBranchPrice,
     deleteInstitutionBranch,
     branchManagementTotalCount,
     studentGrowth,
     earningGrowth,
     sectionAndClasses,
     subject
};

export default BranchManagementController;

