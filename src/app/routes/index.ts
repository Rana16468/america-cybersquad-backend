import express from "express";

import { authRoutes } from "../modules/Auth/auth.routes";
import { userRoute } from "../modules/User/user.route";
import ContactRoute from "../modules/contact/contact.route";
import TestimonialsRoute from "../modules/Testimonials/testimonials.route";
import subscriptionRoute from "../modules/subscription/subscription.routes";
import branchManagement from "../modules/Branch_Management/branch_management.route";
import studentRoute from "../modules/Students/Students.routes";
import TeacherRoute from "../modules/Teacher/Teacher.route";
import announcementRouter from "../modules/Announcements/announcements.routes";
import SupportRouter from "../modules/support/support.route";
import StaffManagementRouter from "../modules/Staff_Management/staff_management.route";
import SubjectRouter from "../modules/subjects/subjects.route";
import ClassDistributionRouter from "../modules/ClassDistribution/class_distribution.route";
import FeesManagementRouter from "../modules/FeesManagement/fees_management.route";
import AssignmentRouter from "../modules/Assignments/assignments.route";
import examAnnouncementRouter from "../modules/ExamAnnouncement/examAnnouncement.route";
import ParentRouter from "../modules/Parent/parent.route";
import nurseRoute from "../modules/nurse/nurse.route";
import LandingPageRouter from "../modules/LandingPage/landingPage.route";
import stripeRoute from "../modules/stripe/stripe.route";
import ScholarshipsManagementRouter from "../modules/ScholarshipsManagement/ScholarshipsManagement.route";






const router = express.Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoute,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path:"/contact",
    route:  ContactRoute
  },
  {
    path:"/testimonials",
    route: TestimonialsRoute
  },
  {
    path:"/subscription",
    route :subscriptionRoute
  },
  {
    path:"/branch_management",
    route: branchManagement
  },

  {
    path:"/students",
    route: studentRoute
  },
   {
    path:"/teacher",
    route: TeacherRoute
   },
   {
    path:"/announcement",
    route: announcementRouter
   },
   {
    path:"/support",
    route:SupportRouter
   },
   {
    path:"/staff",
    route: StaffManagementRouter
   },
   {
    path:"/subject",
    route: SubjectRouter
   },
   {
    path:"/class_distribution",
    route: ClassDistributionRouter
   },
   {
    path:"/fees",
    route:FeesManagementRouter
   },
   {
    path:"/assignments",
    route: AssignmentRouter
   },
   {
    path:"/exam_announcement", 
    route: examAnnouncementRouter
   },
   {
    path:"/parent",
    route: ParentRouter
   },
   {
    path:"/nurse",
    route: nurseRoute
   }, 
   {
    path:"/landing_page", 
    route: LandingPageRouter
   },
   {
    path: "/stripe",
    route: stripeRoute
   },
   {
    path:"/scholarshipsManagement",
    route: ScholarshipsManagementRouter
   }
 

  
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
