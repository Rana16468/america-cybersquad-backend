import {z} from 'zod'


const createScholarshipsManagementSchema=z.object({

    body: z.object({
    studentId: z.string(),
    description: z.string().trim(),
    value: z.number().nonnegative(),
    startDate: z.coerce.date(),
    scholarshipsStatus: z
      .enum(["Active", "Pending", "InActive"])
      .optional(),
  }),

});

const updateScholarshipsManagementSchema = z.object({
  body: z.object({
    studentId: z.string().optional(),

    description: z.string().trim().optional(),

    value: z.number().nonnegative().optional(),

    startDate: z.coerce.date().optional(),

    scholarshipsStatus: z
      .enum(["Active", "Pending", "InActive"])
      .optional(),
  }),
});
const ScholarshipsManagementValidation={
      createScholarshipsManagementSchema,
      updateScholarshipsManagementSchema
}
export default ScholarshipsManagementValidation