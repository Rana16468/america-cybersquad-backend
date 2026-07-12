import { z } from "zod";

 const announcementsSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title is too long"),

    description: z
      .string()
      .min(1, "Description is required")
      .max(2000, "Description is too long"),

    audience: z
      .array(z.string().min(1, "Audience value cannot be empty"))
      .min(1, "At least one audience is required"),
      subscriptionId: z.string({required_error:"subscriptionId  is required"}),


    isDelete: z.boolean().optional().default(false),
  }),
});

 const updateAnnouncementsSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title is too long").optional(),

    description: z
      .string()
      .min(1, "Description is required")
      .max(2000, "Description is too long").optional(),

    audience: z
      .array(z.string().min(1, "Audience value cannot be empty"))
      .min(1, "At least one audience is required"),
      // subscriptionId: z.string({required_error:"subscriptionId  is required"}),
      

    isDelete: z.boolean().optional().default(false),
  }),
});

const AnnouncementsValidation={
    announcementsSchema,
    updateAnnouncementsSchema
};

export default AnnouncementsValidation;

