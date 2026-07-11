import { z } from "zod";
import { AssignmentType, materialType } from "./assignments.constant";

const assignmentSchema = z.object({

    
   body: z.object({
    // subscriptionId: z.string({required_error:"subscriptionId is required"}),
    classDistributionId: z.string({required_error:"classDistributionId is required"}),
    
    classLevel: z.string({required_error:" class level is required"}),
    assignmentTitle: z.string({required_error:"assignmentTitle is required"}),
    assignmentType: z.enum([AssignmentType.HomeWork, AssignmentType.Practice, AssignmentType.Project, AssignmentType.Project]),
    
    assignmentDueDate: z.coerce.date({
    required_error: "Assignment due date is required",
    invalid_type_error: "Invalid date format",
  }),
  


  description: z
    .string({
      required_error: "Description is required",
    })
    .min(1, "Description cannot be empty"),

  attachmentFiles: z.array(z.string({required_error:"attachments is required"})),

  isDelete: z.boolean().optional().default(false),
   })
});


const updateAssignmentSchema = z.object({

    
   body: z.object({
  
    assignmentTitle: z.string({required_error:"assignmentTitle is required"}).optional(),
    assignmentType: z.enum([AssignmentType.HomeWork, AssignmentType.Practice, AssignmentType.Project, AssignmentType.Project]).optional(),
    
    assignmentDueDate: z.coerce.date({
    required_error: "Assignment due date is required",
    invalid_type_error: "Invalid date format",
  }).optional(),
  
  description: z
    .string({
      required_error: "Description is required",
    })
    .min(1, "Description cannot be empty").optional(),

  attachmentFiles: z.array(z.string({required_error:"attachments is required"})).optional(),

  isDelete: z.boolean().optional().default(false),
   })
});

const createClassMaterialSchema= z.object({
    body: z.object({
      // subscriptionId: z.string({required_error:"subscriptionId is required"}),
      assignmentTitle: z.string({required_error:"materialName is required"}),
      classDistributionId: z.string({required_error:"classDistributionId is required"}),
       materialType: z.enum([materialType.materialLink,materialType.materialPDF, materialType.materialVideo, materialType.materialWord]),
      description: z.string({required_error:"description is not required"}).optional(),
      materialFiles: z.array(z.string()).optional(),
      external_link: z.string({required_error:"external_link is not required"}).optional()

    })

});

const updateSpecificClassMaterialSchema= z.object({
   body: z.object({
  
       materialType: z.enum([materialType.materialLink,materialType.materialPDF, materialType.materialVideo, materialType.materialWord]).optional(),
      description: z.string({required_error:"description is not required"}).optional(),
      materialFiles: z.array(z.string()).optional(),
      external_link: z.string({required_error:"external_link is not required"}).optional()

    })
})

const AssignmentValidation={
    assignmentSchema,
    updateAssignmentSchema,
    createClassMaterialSchema,
    updateSpecificClassMaterialSchema
    
    
};

export default AssignmentValidation