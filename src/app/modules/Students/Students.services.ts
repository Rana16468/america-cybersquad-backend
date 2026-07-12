

import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { CreateStudentDto, TSubmitAssignment } from "./Students.interface";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import PrismaQueryBuilder from '../../builder/PrismaQueryBuilder';
import { searchableClassDistribution, searchableClassMaterial, searchableFields } from './Students.constant';
import fs from "fs";
import path from "path";
import generateStudentId from '../../../utils/generateId/generateStudentId';
import { AttendanceStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import config from "../../../config";
import { deleteByPattern, deleteCache, getCache, setCache } from "../../../config/redis";
import { deleteFileIfExists } from "../../../utils/deleteFiles/deleteFileIfExists";
import { getSocketIO } from "../../../socket/connectSocket";



const createStudentIntoDb = async (
  branchAdminId: string,
  payload: CreateStudentDto
):Promise<{ status: boolean; message: string }> => {
  try {
    if (!branchAdminId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Branch admin id is required");
    }

    const isStudentExist = await prisma.student.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (isStudentExist) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Student with this email already exists"
      );
    }

       
    
        const hashedPassword = await bcrypt.hash(
          payload.password,
          Number(config.bcrypt_salt_rounds)
        );
        payload.password = hashedPassword;
    

    // ✅ remove unsafe override possibility
    const { branchAdminId: _ignored, ...safePayload } = payload as CreateStudentDto;

   const result= await prisma.student.create({
      data: {
        branchAdminId,
        role: UserRole.STUDENT,
        studentId: await generateStudentId(UserRole.STUDENT),
        ...safePayload,
      },
    });
    if(!result){
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create student");
    }

    return {
      status: true,
      message: "Student created successfully",
    };
  } catch (error) {
    return catchError(error, "Error creating student in database");
  }
};


const findByAllStudentsIntoDb = async (
  userId: string,
  role: string,
  query: Record<string, any>,
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const className = query.className;
    const branchName = query.branchName;
    const subscriptionId = query.subscriptionId;

    let whereCondition: any = {
      ...queryOptions.where,
    };

    /**
     * ==========================================
     * Institution Owner
     * ==========================================
     */
    if (role === UserRole.INSTITUTIONAL_OWNER) {
      const branches = await prisma.institutionBranch.findMany({
        where: {
          userId,
          isDeleted: false,
        },
        select: {
          subscriptionId: true,
        },
      });

      const subscriptionIds = branches
        .map((item) => item.subscriptionId)
        .filter((id): id is string => Boolean(id));

      whereCondition.subscriptionId = {
        in: subscriptionIds,
      };
    }

    /**
     * ==========================================
     * Branch Admin
     * ==========================================
     */
    else {
      whereCondition.branchAdminId = userId;
    }

    /**
     * ==========================================
     * Filters
     * ==========================================
     */

    if (subscriptionId) {
      whereCondition.subscriptionId = subscriptionId;
    }

    if (className) {
      whereCondition.className = {
        contains: className,
        mode: "insensitive",
      };
    }

    if (branchName) {
      whereCondition.branchAdmin = {
        assignBranch: {
          contains: branchName,
          mode: "insensitive",
        },
      };
    }

    /**
     * ==========================================
     * Query
     * ==========================================
     */

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,
        orderBy: queryOptions.orderBy,
        skip: queryOptions.skip,
        take: queryOptions.take,

        select: {
          id: true,
          studentId: true,
          name: true,
          email: true,
          branchName: true,
          className: true,
          guardianName: true,
          guardianPhone: true,
          photo: true,
          isVerified: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          branchAdmin: {
            select: {
              id: true,
              fullName: true,
              assignBranch: true,
              phoneNumber: true,
              emailAddress: true,
            },
          },

          subscriptions: {
            select: {
              id: true,
              price: true,
            },
          },
        },
      }),

      prisma.student.count({
        where: whereCondition,
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: students,
    };
  } catch (error) {
    return catchError(error, "Error fetching students from database");
  }
};


const findByAllStudents_Institutional_OwnerIntoDb = async (
  subscriptionId: string,
  query: Record<string, any>
) => {
  try {
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();// ✅ safe extraction (no conflict)
    const className = query.className;
    const branchName = query.branchName;

    // ✅ student filter
    const studentFilter: Record<string, any> = {};

    if (className) studentFilter.className = className;
    if (branchName) studentFilter.branchName = branchName;

  
    const whereCondition: any = {
      subscriptionId, 

      ...queryOptions.where,

      ...studentFilter,
    };

    const [result, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,
        orderBy: queryOptions.orderBy,
        skip: queryOptions.skip,
        take: queryOptions.take,

        select: {
          id: true,
          name: true,
          email: true,
          branchName: true,
          className: true,
          guardianName: true,
          guardianPhone: true,
          photo: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,

          // ✅ clean relation select
          subscriptions: {
            select: {
              id: true,
              price: true,
             
            },
          },
        },
      }),

      prisma.student.count({
        where: whereCondition,
      }),
    ]);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: result,
    };
  } catch (error) {
    return catchError(error, "Error fetching students from database");
  }
};

const deleteStudentFromDb = async (
  studentId: string
): Promise<{ status: boolean; message: string }> => {
  try {

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { photo: true }, 
    });

    if (!student) {
      throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
    }

    if (student.photo) {
      const photoArray = Array.isArray(student.photo) ? student.photo : [student.photo];

      photoArray.forEach((photoPath) => {
        const fullPath = path.resolve(photoPath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`Deleted photo file: ${fullPath}`);
          } catch (err) {
            console.warn(`Failed to delete file ${fullPath}:`, err);
          }
        }
      });
    }

    await prisma.student.delete({
      where: { id: studentId },
    });

    return {
      status: true,
      message: "Student and associated photo(s) deleted successfully",
    };
  } catch (error) {
    return catchError(error, "Error deleting student from database");
  }
};



 const updateStudentIntoDb = async (
  studentId: string,
  payload: Partial<CreateStudentDto>  ): Promise<{ status: boolean; message: string }> => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    }); 
    if (!student) {
      throw new ApiError(httpStatus.NOT_FOUND, "Student not found");
    } 
      await prisma.student.update({ 
        where: { id: studentId },
        data: payload,
      });

    return {  
      status: true,
      message: "Student updated successfully",
    };
  } catch (error) {
    return catchError(error, "Error updating student in database");
  }
};

const findMyAllClassListIntoDb = async (
  userId: string,
  query: Record<string, any>
) => {
  try {


    const page = Number(query.page) || 1;

    const limit = Number(query.limit) || 10;

    const skip = (page - 1) * limit;



    const sortBy = query.sortBy || "createdAt";

    const sortOrder: Prisma.SortOrder =
      query.sortOrder === "asc" ? "asc" : "desc";


    const searchTerm = query.searchTerm;

    const classLevel = query.classLevel;

    const day = query.day;

    const assignableSubject = query.assignableSubject;

    const teacherId = query.teacherId;

    const isOnline =
      query.isOnline !== undefined
        ? query.isOnline === "true"
        : undefined;

    
    // const cacheKey = `student-class-list:${userId}:${JSON.stringify(
    //   query
    // )}`;


    // const cachedData = await getCache(cacheKey);

    // if (cachedData) {
    //   return cachedData;
    // }


    const searchCondition: Prisma.ClassDistributionWhereInput =
      searchTerm
        ? {
            OR: [
              {
                roomNumber: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },

              {
                classLevel: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },

              {
                assignableSubject: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },

              {
                day: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },

              // ✅ Teacher Name Search
              {
                teacher: {
                  is: {
                    teacherName: {
                      contains: searchTerm,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              },

              // ✅ Teacher ID Search
              {
                teacher: {
                  is: {
                    teacherId: {
                      contains: searchTerm,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              },
            ],
          }
        : {};



    const classFilter: Prisma.ClassDistributionWhereInput = {};

  
    if (classLevel) {
      classFilter.classLevel = classLevel;
    }

  
    if (day) {
      classFilter.day = day;
    }

    
    if (assignableSubject) {
      classFilter.assignableSubject = assignableSubject;
    }

  
    if (typeof isOnline === "boolean") {
      classFilter.isOnline = isOnline;
    }


    if (teacherId) {
      classFilter.teacher = {
        is: {
          teacherId,
        },
      };
    }



    const classDistributionWhereCondition: Prisma.ClassDistributionWhereInput =
      {
        ...classFilter,

        ...searchCondition,

        students: {
          some: {
            id: userId,
            
          },
        },
      };


    const [studentData, total] = await Promise.all([
      prisma.student.findFirst({
        where: {
          id: userId,

          isVerified: true,

          status: UserStatus.ACTIVE,
        },

        select: {
          id: true,
          branchName:true,
          classDistributions: {
            where: classDistributionWhereCondition,

            orderBy: {
              [sortBy]: sortOrder,
            },

            skip,

            take: limit,

            select: {
              id: true,

              roomNumber: true,

              classLevel: true,

              assignableSubject: true,

              day: true,

              time: true,

              isOnline: true,

            
              teacher: {
                select: {
                  id: true,

                  teacherName: true,

                  teacherId: true,

                  email: true,

                  photo: true,
                },
              },
            },
          },
        },
      }),

      prisma.classDistribution.count({
        where: classDistributionWhereCondition,
      }),
    ]);

 

    const responseData = {
      meta: {
        page,

        limit,

        total,

        totalPage: Math.ceil(total / limit),
      },

      data: studentData,
    };



    // await setCache(cacheKey, responseData, 60 * 5);

  
    return responseData;
  } catch (error) {
    return catchError(error, "Error fetching class list from database");
  }
};

const findMyClassAssignmentIntoDb = async (
  userId: string,
  query: Record<string, any>,
) => {
  try {
    const cacheKey = `class-assignment:${userId}:${JSON.stringify(query)}`;

    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(["assignmentTitle"])
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const {
      isVerified,
      status,
      assignmentType,
      classDistributionId,
      classLevel,
      assignableSubject,
      assignmentStatus,
    } = query;

    const whereCondition: any = {
      id: userId,

      ...(isVerified !== undefined && {
        isVerified: isVerified === "true",
      }),

      ...(status && { status }),

      classDistributions: {
        some: {
          ...(classDistributionId && {
            id: classDistributionId,
          }),

          ...(classLevel && {
            classLevel: {
              equals: classLevel,
              mode: "insensitive",
            },
          }),

          ...(assignableSubject && {
            assignableSubject: {
              equals: assignableSubject,
              mode: "insensitive",
            },
          }),
        },
      },
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,

        orderBy: queryOptions.orderBy,

        skip: queryOptions.skip,

        take: queryOptions.take,

        select: {
          id: true,
          name: true,

          classDistributions: {
            where: {
              ...(classDistributionId && {
                id: classDistributionId,
              }),

              ...(classLevel && {
                classLevel: {
                  equals: classLevel,
                  mode: "insensitive",
                },
              }),

              ...(assignableSubject && {
                assignableSubject: {
                  equals: assignableSubject,
                  mode: "insensitive",
                },
              }),
            },

            select: {
              id: true,
              classLevel: true,
              assignableSubject: true,

              teacher: {
                select: {
                  teacherName: true,
                  teacherId: true,
                  email: true,
                  phoneNumber: true,
                },
              },

              classAssignments: {
                where: {
                  isDelete: false,

                  ...(assignmentType && {
                    assignmentType,
                  }),
                },

                orderBy: {
                  createdAt: "desc",
                },

                select: {
                  id: true,
                  assignmentTitle: true,
                  assignmentType: true,
                  assignmentDueDate: true,
                  description: true,
                  attachmentFiles: true,
                  assessmentAvailable: true,
                  createdAt: true,

                  submitAssignments: {
                    where: {
                      studentId: userId,
                      isDelete: false,
                    },

                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      prisma.student.count({
        where: whereCondition,
      }),
    ]);

    let completed = 0;
    let pending = 0;
    let due = 0;

    const data = students.map((student) => ({
      ...student,

      classDistributions: student.classDistributions.map((distribution) => ({
        ...distribution,

        classAssignments: distribution.classAssignments
          .map((assignment) => {
            let status = "Due";

            if (assignment.submitAssignments.length > 0) {
              status = assignment.assessmentAvailable
                ? "Completed"
                : "Pending";
            }

            if (status === "Completed") completed++;

            if (status === "Pending") pending++;

            if (status === "Due") due++;

            return {
              id: assignment.id,
              assignmentTitle: assignment.assignmentTitle,
              assignmentType: assignment.assignmentType,
              assignmentDueDate: assignment.assignmentDueDate,
              description: assignment.description,
              attachmentFiles: assignment.attachmentFiles,
              assessmentAvailable: assignment.assessmentAvailable,
              createdAt: assignment.createdAt,
              status,
            };
          })
          .filter((assignment) => {
            if (!assignmentStatus) return true;

            return (
              assignment.status.toLowerCase() ===
              assignmentStatus.toLowerCase()
            );
          }),
      })),
    }));

    const response = {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },

      summary: {
        total: completed + pending + due,
        completed,
        pending,
        due,
      },

      data,
    };

    await setCache(cacheKey, response, 60 * 5);

    return response;
  } catch (error) {
    return catchError(error, "Error fetching class assignments");
  }
};


const submitAssignmentIntoDb = async (
  studentId: string,
  payload: TSubmitAssignment
) => {
  try {

    const isExistAssignment =
      await prisma.classAssignment.findUnique({
        where: {
          id: payload.classAssignmentId,
        },
        select: {
          id: true,
          assessmentAvailable: true,

          classDistributions: {
            select: {
              teacher: {
                select: {
                  id: true,
                  subscriptionId: true,
                },
              },
            },
          },
        },
      });

    if (!isExistAssignment) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "This assignment does not exist"
      );
    }


    if (isExistAssignment.assessmentAvailable) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Submission deadline finished"
      );
    }

    // 3. Validate teacher relation
    if (
      !isExistAssignment.classDistributions ||
      !isExistAssignment.classDistributions.teacher
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Teacher information not found"
      );
    }

 
    if (
      !payload.uploadFiles ||
      !Array.isArray(payload.uploadFiles) ||
      payload.uploadFiles.length < 1
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "At least one file is required"
      );
    }


    const alreadyUploaded =
      await prisma.submitAssignment.findFirst({
        where: {
          studentId,
          classAssignmentId: payload.classAssignmentId,
          isDelete: false,
        },
        select: {
          id: true,
        },
      });

    if (alreadyUploaded) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You already uploaded this assignment"
      );
    }

 

    const result = await prisma.$transaction(
      async (tx) => {
        
        const submitAssignment =
          await tx.submitAssignment.create({
            data: {
              studentId,
              classAssignmentId:
                payload.classAssignmentId,

              uploadFiles: {
                create: payload.uploadFiles.map(
                  (file) => ({
                    fileUrl: file.fileUrl,
                  })
                ),
              },
            },

            include: {
              uploadFiles: true,
            },
          });

        const notification =
          await tx.notification.create({
            data: {
              title: "📢 Assignment Submitted",

              message:
                "A student submitted an assessment",

              teacherId:
                isExistAssignment
                  .classDistributions.teacher.id,

              subscriptionId:
                isExistAssignment
                  .classDistributions.teacher
                  .subscriptionId,
            },
          });

        return {
          submitAssignment,
          notification,
        };
      }
    );



    const io = getSocketIO() as any;

    io.to(
      `teacher::${isExistAssignment.classDistributions.teacher.id}`
    ).emit("notification", {
      id: result.notification.id,
      title: result.notification.title,
      message: result.notification.message,
      createdBy: UserRole.STUDENT,
      timestamp: new Date().toISOString(),
      teacherId:
        isExistAssignment.classDistributions.teacher.id,
    });

    return {
      status: true,
      message: "Assignment submitted successfully"
      
    };
  } catch (error) {
    catchError(error);
  }
};




const findBySpecifAssignmentIntoDb = async (
  classAssignmentId: string,
  studentId: string
) => {
  try {
    const result=await prisma.submitAssignment.findFirst({
      where:{
        classAssignmentId:classAssignmentId,
        studentId
      },select:{
        id:true ,
        uploadFiles:{
          select:{
            id:true , 
            submitAssignmentId:true,
            fileUrl:true
          }
        },
        createdAt:true,
        updatedAt:true
      }
    });

    return result;


    
  } catch (error) {
     return  catchError(error);
  }
};

const updateAndAddAssignmentIntoDb = async (
  id: string,
  payload: Partial<TSubmitAssignment>
):Promise<{
  success:boolean,
  message:string
}> => {
  try {
    if (!payload.uploadFiles?.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Upload files are required"
      );
    }

    const isExistSubmitAssignment =
      await prisma.submitAssignmentFile.findFirst({
        where: {
          id,
          submitAssignmentId: payload.submitAssignmentId,
        },
        select: {
          id: true,
          submitAssignmentId: true,
          fileUrl: true,
          submitAssignment: {
            select: {
              classAssignments: {   
                select: {
                  assessmentAvailable: true,
                },
              },
            },
          },
        },
      });

    if (!isExistSubmitAssignment) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Assignment not found"
      );
    }
    if (
      isExistSubmitAssignment
        .submitAssignment.classAssignments
      
        .assessmentAvailable
    ) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Assessment uploading expired"
      );
    }

    const result = await prisma.$transaction(async (tx) => {

      const updatedFile = await tx.submitAssignmentFile.update({
        where: {
          id: isExistSubmitAssignment.id,
        },
        data: {
          fileUrl: payload.uploadFiles![0].fileUrl,
        },
      });

  
      const remainingFiles = payload.uploadFiles!.slice(1);

      if (remainingFiles.length > 0) {
        await tx.submitAssignmentFile.createMany({
          data: remainingFiles.map((file) => ({
            submitAssignmentId: payload.submitAssignmentId!,
            fileUrl: file.fileUrl,
          })),
        });
      }

      return updatedFile;
    });

    try {
      deleteFileIfExists(isExistSubmitAssignment.fileUrl);
    } catch (err) {
      console.log("file delete failed:", err);
    }

    return result && {
      success: true,
      message: "Assignment updated successfully"
     
    };

  } catch (error) {
    return catchError(error);
  }
};


const deleteSubmitAssignmentIntoDb = async (
  id: string,
  studentId: string
) => {
  try {
    const assignmentFile =
      await prisma.submitAssignmentFile.findFirst({
        where: {
          id,
          submitAssignment: {
            studentId,
          },
        },

        select: {
          id: true,
          fileUrl: true,
          submitAssignmentId: true,

          submitAssignment: {
            select: {
              _count: {
                select: {
                  uploadFiles: true,
                },
              },
            },
          },
        },
      });

    if (!assignmentFile) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Assignment file not found"
      );
    }

    const totalFiles =
      assignmentFile.submitAssignment
        ._count.uploadFiles;

    await prisma.$transaction(async (tx) => {
      await tx.submitAssignmentFile.delete({
        where: {
          id: assignmentFile.id,
        },
      });

      if (totalFiles <= 1) {
        await tx.submitAssignment.delete({
          where: {
            id: assignmentFile.submitAssignmentId,
          },
        });
      }
    });

    await Promise.all([
      deleteCache(
        `submit-assignment-${assignmentFile.submitAssignmentId}`
      ),

      deleteByPattern(
        `student-assignments-${studentId}*`
      ),

      deleteByPattern(
        `class-assignment-*`
      ),
    ]);

    try {
      deleteFileIfExists(
        assignmentFile.fileUrl
      );
    } catch (err) {
      return catchError( err );
    }

    return {
      success: true,
      message:
        "Assignment deleted successfully",
    };

  } catch (error) {
    return catchError(error);
  }
};



const findMyClassScheduleIntoDb = async (
  studentId: string,
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {
   

    const cacheKey = `class-schedule:${studentId}:${subscriptionId}:${JSON.stringify(
      query
    )}`;

    

    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableClassDistribution)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();
    const day = query.day as string;

    const classLevel = query.classLevel as string;

    const assignableSubject =
      query.assignableSubject as string;

    const isOnline =
      query.isOnline !== undefined
        ? query.isOnline === "true"
        : undefined;


    const classDistributionFilter: Record<
      string,
      any
    > = {};

    if (day) {
      classDistributionFilter.day = day;
    }

    if (classLevel) {
      classDistributionFilter.classLevel =
        classLevel;
    }

    if (assignableSubject) {
      classDistributionFilter.assignableSubject =
        {
          contains: assignableSubject,
          mode: "insensitive",
        };
    }

    if (typeof isOnline === "boolean") {
      classDistributionFilter.isOnline =
        isOnline;
    }


    const whereCondition: Record<
      string,
      any
    > = {
      id: studentId,
      subscriptionId,

      ...(Object.keys(classDistributionFilter)
        .length > 0 && {
        classDistributions: {
          some: classDistributionFilter,
        },
      }),
    };



    const [result, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,

        select: {
          branchName: true,
          classDistributions: {
            where: {
              ...classDistributionFilter,
            },

            orderBy:
              queryOptions.orderBy || {
                createdAt: "desc",
              },

            skip: queryOptions.skip,

            take: queryOptions.take,

            select: {
              id: true,

              classLevel: true,

              assignableSubject: true,

              day: true,

              time: true,

              isOnline: true,

              roomNumber: true,

              createdAt: true,

              
            },
          },
        },
      }),

      prisma.classDistribution.count({
        where: {
          students: {
            some: {
              id: studentId,
              subscriptionId,
            },
          },

          ...classDistributionFilter,
        },
      }),
    ]);



    const page = Number(query.page) || 1;

    const limit = Number(query.limit) || 10;

    

    const responseData = {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },

      data: result,
    };

    
    await setCache(
      cacheKey,
      responseData,
      60 * 5 
    );

    return responseData;
  } catch (error) {
    return catchError(
      error,
      "Error fetching class schedule"
    );
  }
};

const findMyClassAttendanceHistoryIntoDb = async (
  studentId: string,
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {


    const cacheKey = `attendance-history:${studentId}:${subscriptionId}:${JSON.stringify(
      query
    )}`;

    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(["attendanceStatus"])
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();
    const {
      attendanceStatus,
      className,
      branchName,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = query as Record<string, string>;



    const whereCondition: Record<string, any> = {
      studentId,
      subscriptionId,

      ...(attendanceStatus && {
        attendanceStatus: {
          equals: attendanceStatus,
        },
      }),

      ...(startDate || endDate
        ? {
            AttendanceDate: {
              ...(startDate && {
                gte: new Date(startDate),
              }),

              ...(endDate && {
                lte: new Date(endDate),
              }),
            },
          }
        : {}),

      students: {
        id: studentId,
        subscriptionId,

        ...(className && { className }),

        ...(branchName && { branchName }),
      },

      ...queryOptions.where,
    };

    const [
      attendanceHistory,
      total,
      groupedAttendance,
    ] = await Promise.all([
      prisma.attendanceSheet.findMany({
        where: whereCondition,

        orderBy:
          queryOptions.orderBy ?? {
            AttendanceDate: "desc",
          },

        skip: queryOptions.skip,

        take: queryOptions.take,

        select: {
          id: true,

          AttendanceDate: true,

          attendanceStatus: true,

          createdAt: true,

          updatedAt: true,

          students: {
            select: {
              className: true,
            },
          },
        },
      }),

      prisma.attendanceSheet.count({
        where: whereCondition,
      }),

      prisma.attendanceSheet.groupBy({
        by: ["attendanceStatus"],

        where: {
          studentId,
          subscriptionId,
        },

        _count: {
          attendanceStatus: true,
        },
      }),
    ]);



    const present =
      groupedAttendance.find(
        (item) =>
          item.attendanceStatus ===
          AttendanceStatus.PRESENT
      )?._count.attendanceStatus || 0;

    const absent =
      groupedAttendance.find(
        (item) =>
          item.attendanceStatus ===
          AttendanceStatus.ABSENT
      )?._count.attendanceStatus || 0;

    const totalAttendance = present + absent;

    const calculatePercentage = (
      value: number,
      total: number
    ) =>
      total
        ? Number(
            ((value / total) * 100).toFixed(2)
          )
        : 0;

    const statistics = {
      totalAttendance,

      present,

      absent,

      presentPercentage:
        calculatePercentage(
          present,
          totalAttendance
        ),

      absentPercentage:
        calculatePercentage(
          absent,
          totalAttendance
        ),
    };



    const responseData = {
      meta: {
        page: Number(page),

        limit: Number(limit),

        total,

        totalPage: Math.ceil(
          total / Number(limit)
        ),
      },

      statistics,

      data: attendanceHistory,
    };



    await setCache(
      cacheKey,
      responseData,
      60 * 5
    );

    return responseData;
  } catch (error) {
    return catchError(
      error,
      "Error fetching attendance history"
    );
  }
};

const findMyClassMaterialIntoDb = async (
  studentId: string,
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {


    const cacheKey = `class-material:${studentId}:${subscriptionId}:${JSON.stringify(
      query
    )}`;



    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }
    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableClassMaterial)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();
    const classLevel =
      query.classLevel as string;
    const assignableSubject =
      query.assignableSubject as string;
    const materialType =
      query.materialType as string;
    const classDistributionFilter: Record<
      string,
      any
    > = {};

    if (classLevel) {
       classDistributionFilter.classLevel =
        classLevel;
    }

    if (assignableSubject) {
      classDistributionFilter.assignableSubject =
        {
          contains: assignableSubject,
          mode: "insensitive",
        };
    }

   

    const materialFilter: Record<string, any> = {};

    if (materialType) {
      materialFilter.materialType = {
        contains: materialType,
        mode: "insensitive",
      };
    }

   

    const whereCondition: Record<string, any> = {
      id: studentId,
      subscriptionId,
    };

    

    const [result, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,

        select: {
          id: true,
          branchName: true,
          classDistributions: {
            where: classDistributionFilter,

            orderBy:
              queryOptions.orderBy || {
                createdAt: "desc",
              },

            skip: queryOptions.skip,
            take: queryOptions.take,

            select: {
              id: true,
              classLevel: true,
              assignableSubject: true,

              teacher: {
                select: {
                  teacherName: true,
                  email: true,
                  teacherId: true,
                },
              },

              classMaterials: {
                where: materialFilter,

                orderBy: {
                  createdAt: "desc",
                },

                select: {
                  id: true,
                  materialType: true,
                  description: true,
                  external_link: true,
                  materialFiles: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),

      prisma.classMaterial.count({
        where: {
          ...materialFilter,
        },
      }),
    ]);



    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const responseData = {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },

      data: result,
    };



    await setCache(
      cacheKey,
      responseData,
      60 * 5 
    );

    return responseData;
  } catch (error) {
    return catchError(
      error,
      "Error fetching class materials"
    );
  }
};

const StudentsService = {
  createStudentIntoDb,
  findByAllStudentsIntoDb,
  findByAllStudents_Institutional_OwnerIntoDb,
  deleteStudentFromDb,
  updateStudentIntoDb,
  findMyAllClassListIntoDb,
  findMyClassAssignmentIntoDb,
  submitAssignmentIntoDb,
  findBySpecifAssignmentIntoDb,
  updateAndAddAssignmentIntoDb,
  deleteSubmitAssignmentIntoDb,
  findMyClassScheduleIntoDb,
  findMyClassAttendanceHistoryIntoDb,
  findMyClassMaterialIntoDb
};
export default StudentsService;