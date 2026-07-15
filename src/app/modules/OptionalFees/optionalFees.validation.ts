import { z } from "zod";
import {
  Category,
  Frequency,
  OptionalFeesStatus,
} from "@prisma/client";

export const createOptionalFeesSchema = z.object({
  body: z.object({
    studentId: z.string(),
    feesName: z.string().trim().min(1),
amount: z.number(),
    category: z.nativeEnum(Category).optional(),
    status: z.nativeEnum(OptionalFeesStatus).optional(),
    frequency: z.nativeEnum(Frequency),

    description: z.string().optional(),
    additionalNote: z.string().optional(),
  }),
});

export const updateOptionalFeesSchema = z.object({
  body: z.object({
    studentId: z.string().optional(),
    
    feesName: z.string().trim().optional(),
amount: z.number().optional(),
    category: z.nativeEnum(Category).optional(),
    status: z.nativeEnum(OptionalFeesStatus).optional(),
    frequency: z.nativeEnum(Frequency).optional(),

    description: z.string().optional(),
    additionalNote: z.string().optional(),
  }),
});