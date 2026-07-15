import { Category, Frequency, OptionalFeesStatus } from "@prisma/client";

export interface TOptionalFees {
  studentId: string;
  subscriptionId: string;
  feesName: string;
  amount:number
  category: Category;
  status: OptionalFeesStatus;
  frequency: Frequency;
  description?: string;
  additionalNote?: string;
}