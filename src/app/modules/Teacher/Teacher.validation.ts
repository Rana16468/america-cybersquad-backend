import { z } from "zod";
import { attendanceStatus } from "./Teacher.constant";

 const TeacherSchema = z.object({
   body: z.object({
     teacherName: z.string({
    required_error: "Teacher name is required",
  }),
  email: z.string({
    required_error: "Email is required",
  }).email("Invalid email address"),
  phoneNumber: z.string({
    required_error: "Phone number is required",
  }),
  branchName: z.string({
    required_error: "Branch name is required",
  }),
  subject: z.array(z.string(), {
    required_error: "Subject array is required",
  }),
  assignClass: z.array(z.string(), {
    required_error: "Assign class array is required",
  }),
  password: z.string({
    required_error: "Password is required",
  }).min(6, "Password must be at least 6 characters"),
  address: z.string({
    required_error: "Address is required",
  }),
  photo: z.string().optional(),
  subscriptionId: z.string({
    required_error: "Subscription ID is required",
  }),
   })
});



 const TeacherUpdateSchema = z.object({
   body: z.object({
     teacherName: z.string({
    required_error: "Teacher name is required",
  }),
  email: z.string({
    required_error: "Email is required",
  }).email("Invalid email address"),
  phoneNumber: z.string({
    required_error: "Phone number is required",
  }),
  branchName: z.string({
    required_error: "Branch name is required",
  }),
  subject: z.array(z.string(), {
    required_error: "Subject array is required",
  }),
  assignClass: z.array(z.string(), {
    required_error: "Assign class array is required",
  }),
  address: z.string({
    required_error: "Address is required",
  }),
  photo: z.string().optional()

   })
});
 const attendanceStatusEnum = z.enum([attendanceStatus.present, attendanceStatus.absent], {
  errorMap: () => ({ message: `Attendance status must be either '${attendanceStatus.present}' or '${attendanceStatus.absent}'` }),
}).default(attendanceStatus.absent); 


 export const studentAttendanceSchema = z.object({
  studentId: z
    .string({
      required_error: "studentId is required",
    })
    .min(1, "studentId cannot be empty"),

  attendanceStatus: attendanceStatusEnum,
});

 const recordAttendanceSchema = z.object({
  body: z.object({
    attendanceDate: z
      .string({
        required_error: "attendanceDate is required",
      })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),

    

    subscriptionId: z
      .string({
        required_error: "subscriptionId is required",
      })
     ,

    students: z
      .array(studentAttendanceSchema, {
        required_error: "students array is required",
      })
      .min(1, "At least 1 student required")
      .max(100, "Maximum 100 students allowed"),
  }),
});

 const updateRecordAttendanceSchema = z.object({
  body: z.object({
    attendanceDate: z
      .string({
        required_error: "attendanceDate is required",
      })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),

    students: z
      .array(studentAttendanceSchema, {
        required_error: "students array is required",
      })
      .min(1, "At least 1 student required")
      .max(100, "Maximum 100 students allowed"),
  }),
});


const onlineClassRecordedOfTeachersSchema=z.object({
  body: z.object({
    // subscriptionId: z.string({
    //   required_error: "subscriptionId is required",
    // }),
    classDistributionId: z.string({
      required_error: "classDistributionId is required",
    }),
    link: z.string({
      required_error: "link is required",
    }).url("Invalid URL format"),
  })
});

const storeClassRecordingLinkOfTeachersSchema=z.object({
  body: z.object({
    subscriptionId: z.string({
      required_error: "subscriptionId is required",
    }).optional(),
    classDistributionId: z.string({
      required_error: "classDistributionId is required",
    }).optional(),
    recordingUrl: z.string({
      required_error: "recordingUrl is required",
    }).url("Invalid URL format"),
  })
});



const teacherValidation = {
  TeacherSchema,
   TeacherUpdateSchema,
   recordAttendanceSchema,
   updateRecordAttendanceSchema,
   onlineClassRecordedOfTeachersSchema,
   storeClassRecordingLinkOfTeachersSchema
};


export default teacherValidation;
