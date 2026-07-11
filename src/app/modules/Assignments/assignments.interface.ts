
type AssignmentType= "HomeWork"  | "Practice" | "Project" | "Quiz";
type MaterialsType="pdf" | "word" | "video" | "external_link"
export type TAssignments = {
  materialName: string
  assignmentTitle: string;
  assignmentType: AssignmentType;
  assignmentDueDate: Date;
  description: string;
  attachmentFiles: string[];
  classDistributionId: string;   
  subscriptionId: string;       
};
export  interface TMaterials {
  classDistributionId: string;   
  assignmentTitle: string
  subscriptionId: string;       
   materialType:MaterialsType;
   materialName: string
   description?:string;
   materialFiles?: string[];
   external_link?: string

};

