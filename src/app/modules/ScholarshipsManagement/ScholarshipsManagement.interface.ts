export type TScholarshipsStatus =
  | "Active"
  | "Pending"
  | "InActive";

export interface TScholarshipsManagement {
  studentId: string;
  subscriptionId: string;
  description?: string;
  value: number;
  startDate: Date;
  scholarshipsStatus?: TScholarshipsStatus;
}