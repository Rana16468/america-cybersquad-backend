import { UserRole } from '@prisma/client';
import express from  'express';
import validateRequest from '../../middlewares/validateRequest';
import AnnouncementsValidation from './announcements.validation';
import AnnouncementsController from './announcements.controller';
import auth from '../../middlewares/auth';
import branchAdminAuth from '../../middlewares/branchAdminAuth';


const router=express.Router();
router.post("/send_new_announcement", validateRequest(AnnouncementsValidation.announcementsSchema), AnnouncementsController.sendAnnouncements);
router.get("/find_by_announcement", AnnouncementsController.findByAnnouncement);
router.get("/find_by_all_announcement", auth(UserRole.ADMIN, UserRole.SUPER_ADMIN), AnnouncementsController.findAllAnnouncement);
router.get("/find_by_specific_announcement/:announcementId",branchAdminAuth(UserRole.BRANCH_ADMIN),AnnouncementsController. findBySpecificAnnouncements  );
router.patch("/update_announcement/:announcementId", branchAdminAuth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER), validateRequest(AnnouncementsValidation.updateAnnouncementsSchema),  AnnouncementsController.updateAnnouncement)
router.delete("/delete_announcements/:announcementId",  branchAdminAuth(UserRole.BRANCH_ADMIN, UserRole.INSTITUTIONAL_OWNER),AnnouncementsController.deleteAnnouncements);



const announcementRouter=router;

export default announcementRouter;

