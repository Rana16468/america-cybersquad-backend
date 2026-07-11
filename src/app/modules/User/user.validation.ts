
import { object, z } from "zod";
import { UserRole } from "@prisma/client";

 const createUserZodSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    schoolName: z.string({required_error:"school name is required"}),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.nativeEnum(UserRole).default(UserRole.STUDENT),
    country: z.string().min(1, "Country is required"),
    city: z.string().min(1, "City is required"),
    state : z.string({required_error:"state is required"}),
    branches : z.number({required_error:"branches is not required"}).optional()

  }),
});

 const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    className:z.string().optional(),
     guardianName: z.string().optional(),
guardianPhone: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    photo: z.string().optional(),
  }),
});

 const verificationCodeZodSchema = z.object({
   body:z.object({
      verificationCode: z.string()
   })
});

const changePasswordSchema = z.object({
  body: z.object({
    newpassword: z
      .string({ required_error: "new password is required" })
      .min(6, { message: "min 6 character accepted" }),
    oldpassword: z
      .string({ required_error: "old password is  required" })
      .min(6, { message: "min 6 character accepted" }),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is Required" })
      .email("Invalid email format")
      .refine(
        (email) => {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        {
          message: "Invalid email format",
        }
      ),
  }),
});

const verificationCodeSchema = z.object({
  body: z.object({
    verificationCode: z
      .number({ required_error: " verificationCode is require" })
      .min(6, { message: "min 4  number accepted" }),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: "userId is require" }),
    password: z.string({required_error: "password is require" }),
  }),
});


 const userValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  verificationCodeZodSchema,
  changePasswordSchema,
  forgotPasswordSchema ,
  verificationCodeSchema,
  resetPasswordSchema
};
export default userValidation;
