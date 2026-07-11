import { z } from "zod";

 const createSupportSchema = z.object({
  body: z.object({
    // subscriptionId: z
    //   .string({ required_error: "subscriptionId is required" })
    //   .min(1, "subscriptionId cannot be empty"),

    name: z
      .string({ required_error: "name is required" })
      .min(1, "name cannot be empty")
      .max(100, "name is too long"),

    email: z
      .string({ required_error: "email is required" })
      .email("Invalid email format"),

    subject: z
      .string({ required_error: "subject is required" })
      .min(1, "subject cannot be empty")
      .max(200, "subject is too long"),

    message: z
      .string({ required_error: "message is required" })
      .min(1, "message cannot be empty")
      .max(5000, "message is too long")
  }),
});

const SupportValidation ={
    createSupportSchema
};

export default SupportValidation;


