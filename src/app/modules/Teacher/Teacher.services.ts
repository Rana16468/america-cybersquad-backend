import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import catchError from "../../../errors/catchError";
import prisma from "../../../shared/prisma";
import { ClassRecordedOfTeachers, RecordAttendancePayload, StoreClassRecording, Teacher } from "./Teacher.interface";
import bcrypt from "bcrypt";
import PrismaQueryBuilder from "../../builder/PrismaQueryBuilder";
import { searchableTeacherFields, teacherFilterableFields, teacherSearchableFields } from "./Teacher.constant";
import fs from "fs";
import path from "path";
import generateTeacherId from "../../../utils/generateId/generateTeacherId";
import { AttendanceStatus, UserRole } from "@prisma/client";

import { getCache,  setCache } from "../../../config/redis";
import { getSocketIO } from "../../../socket/connectSocket";
import PrismaRelationQueryBuilder from "../../builder/PrismaQueryBuilder";



const createTeacherIntoDb = async (
  branchAdminId: string,
  payload: Partial<Teacher>
): Promise<{ status: true; message: string }> => {
  try {
    const { teacherName, email, password, phoneNumber, branchName, subject, assignClass, address, subscriptionId } = payload;

    if (!teacherName || !email || !password) {
      throw new Error("teacherName, email, and password are required");
    }

    const isExistTeacher = await prisma.teacher.findUnique({
      where: { email },
      select: { id: true },
    });
    if (isExistTeacher) {
      throw new ApiError(httpStatus.FOUND, "Teacher with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(
          payload.password as string,
          Number(config.bcrypt_salt_rounds)
        );

        console.log("Hashed password:", hashedPassword); // Debugging log

    const teacher = await prisma.teacher.create({
      data: {
        teacherName,
        email,
        password: hashedPassword,
        branchAdminId,
        role : UserRole.TEACHER,
        teacherId: await generateTeacherId(UserRole.TEACHER),
        phoneNumber: phoneNumber ?? "",
        branchName: branchName ?? "",
        subject: subject ?? [],
        assignClass: assignClass ?? [],
        address: address ?? "",
        subscriptionId: subscriptionId ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    if (!teacher) {
      throw new Error("Failed to create teacher");
    };



    return {
      status: true,
      message: "Teacher created successfully",
    };
  } catch (error) {
    return catchError(error, "Error creating teacher in database");
  }
};


const findByAllTeachersBranchAdminIntoDb = async (
  branchAdminId: string,
  query: Record<string, unknown>
) => {
  try {
    

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableTeacherFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const { branchName, subscriptionId } = query;

    const teacherFilter: any = {};

    if (branchName) {
      teacherFilter.branchName = branchName;
    }

    const subscriptionFilter: any = {};

    if (subscriptionId) {
      subscriptionFilter.id = subscriptionId;
    }

    const result = await prisma.teacher.findMany({
      where: {
        branchAdminId, // 🔐 restrict to logged-in admin

        ...queryOptions.where,
        ...teacherFilter,

        ...(Object.keys(subscriptionFilter).length > 0 && {
          subscriptions: {
            is: subscriptionFilter,
          },
        }),
      },

      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        id: true,
        teacherName: true,
        email: true,
        teacherId:true, 
        phoneNumber: true,
        branchName: true,
        subject: true,
        assignClass: true,
        address: true,
        photo: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true
      },
    });

    const total = await prisma.teacher.count({
      where: {
        branchAdminId,
        ...queryOptions.where,
        ...teacherFilter,
        ...(Object.keys(subscriptionFilter).length > 0 && {
          subscriptions: {
            is: subscriptionFilter,
          },
        }),
      },
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage,
      },
      data: result,
    };
  } catch (error) {
    return catchError(error, "Error finding teachers in database");
  }
};


const findBySingleTeacherIntoDb = async (teacherId: string) => {
  try {
    const teacher = await prisma.teacher.findUnique({   
        where: { id: teacherId },
        select: {   
            id: true,
            teacherName: true,
            email: true,
            phoneNumber: true,
            teacherId:true,
            branchName: true,
            subject: true,
            assignClass: true,
            address: true,
            photo: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!teacher) {
        throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");
    }

    return teacher;
  } catch (error) {
    return catchError(error, "Error finding teacher in database");
  } 
};


const updateTeacherIntoDb = async (teacherId: string, payload: Partial<Teacher>) => {
  try {
    const { teacherName, email, phoneNumber, branchName, subject, assignClass, address } = payload;

    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        teacherName,
        email,
        phoneNumber,
        branchName,
        subject,
        assignClass,
        address
      }
    });

   if (!teacher) {
    throw new ApiError(httpStatus.NOT_FOUND, "Failed to update teacher");
   }    
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to update teacher");
  }
};


const deleteTeacherFromDb = async (
  teacherId: string
): Promise<{ status: boolean; message: string }> => {
  try {
    // 🔍 Find teacher
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { photo: true },
    });

    if (!teacher) {
      throw new ApiError(httpStatus.NOT_FOUND, "Teacher not found");
    }
    if (teacher.photo) {
      const photoArray = Array.isArray(teacher.photo)
        ? teacher.photo
        : [teacher.photo];

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


    await prisma.teacher.delete({
      where: { id: teacherId },
    });

    return {
      status: true,
      message: "Teacher and associated photo(s) deleted successfully",
    };
  } catch (error) {
    return catchError(error, "Error deleting teacher from database");
  }
};



const findByAllTeachers_Institutional_OwnerIntoDb = async (
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {
    const searchableFields = [
      "teacherName",
      "email",
      "phoneNumber",
      "branchName",
    ];

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    const { branchName, subscriptionId: querySubscriptionId } = query;

    const teacherFilter: Record<string, any> = {};

    if (branchName) {
      teacherFilter.branchName = branchName;
    }

    const subscriptionFilter: Record<string, any> = {};

    if (querySubscriptionId) {
      subscriptionFilter.id = querySubscriptionId;
    }

    const whereCondition = {
      subscriptionId, 
      isDeleted: false,
      ...queryOptions.where,
      ...teacherFilter,

      ...(Object.keys(subscriptionFilter).length > 0 && {
        subscriptions: {
          is: subscriptionFilter,
        },
      }),
    };


    const result = await prisma.teacher.findMany({
      where: whereCondition,
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,

      select: {
        id: true,
        teacherName: true,
        email: true,
        phoneNumber: true,
        branchName: true,
        subject: true,
        assignClass: true,
        address: true,
        photo: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        branchAdmin: {
          select: {
            id: true,
            fullName : true,
    phoneNumber: true,
    emailAddress: true,
    joinDate: true ,
    role : true,
    assignBranch: true

          }
        }
       
      },
    });

    // ✅ Count total
    const total = await prisma.teacher.count({
      where: whereCondition,
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage,
      },
      data: result,
    };
  } catch (error) {
    return catchError(error, "Error fetching teachers from database");
  }
};

const findBySpecificClassListOfTeachersIntoDb = async (
  teacherId: string,
  query: Record<string, unknown>
) => {
  try {
   

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(teacherSearchableFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const queryOptions = queryBuilder.build();

    // Optional extra filters
    const { classLevel, day } = query;

    const extraFilter: Record<string, any> = {};

    if (classLevel) {
      extraFilter.classLevel = classLevel;
    }

    if (day) {
      extraFilter.day = day;
    }

    // Final where condition
    const whereCondition = {
      teacherId,
      ...queryOptions.where,
      ...extraFilter,
    };

    const result = await prisma.classDistribution.findMany({
      where: whereCondition,
      orderBy: queryOptions.orderBy,
      skip: queryOptions.skip,
      take: queryOptions.take,
      select: {
        id: true,
        classLevel: true,
        capacity: true,
        roomNumber: true,
        assignableSubject: true,
        day: true,
        time: true,
        isOnline: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ✅ Total count
    const total = await prisma.classDistribution.count({
      where: whereCondition,
    });

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage,
      },
      data: result,
    };
  } catch (error) {
    return catchError(
      error,
      "Error fetching class list for specific teacher"
    );
  }
};

const findBySpecificStudentListOfTeachersIntoDb = async (
  teacherId: string,
  query: Record<string, unknown>
) => {
  try {
    const queryBuilder = new PrismaRelationQueryBuilder(query)
      .search([
        "name",
        "className",
        "email",
        "studentId",
        "classDistributions.classLevel",
        "classDistributions.assignableSubject",
      ])
      .filter()
      .sort()
      .paginate();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const { classLevel, day } = query;

    const extraFilter: Record<string, any> = {};

    if (classLevel) extraFilter.classLevel = classLevel;
    if (day) extraFilter.day = day;

    const whereCondition = {
      AND: [
        where,
        {
          classDistributions: {
            some: {
              teacherId,
              ...extraFilter,
            },
          },
        },
      ],
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: whereCondition,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
          className: true,
          photo: true,
          guardianPhone: true ,
          classDistributions: {
            where: {
              teacherId,
              ...extraFilter,
            },
            select: {
              id: true,
              classLevel: true,
              assignableSubject: true,
              day: true,
              time: true,
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
      success: true,
      message: "Student list fetched successfully",
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: students,
    };
  } catch (error) {
    return catchError(
      error,
      "Error fetching student list for specific teacher"
    );
  }
};

const findBySpecificStudentAttendanceOfTeachersIntoDb = async (
  teacherId: string,
  classDistributionId: string,
  query: Record<string, unknown>
) => {
  try {
    // attendanceDate-কে QueryBuilder থেকে আলাদা করে নাও
    const {
      attendanceDate,
      classLevel,
      day,
      ...studentQuery
    } = query;

    // const cacheKey = `teacher_attendance_students:${teacherId}:${classDistributionId}:${
    //   attendanceDate || "today"
    // }:${JSON.stringify(studentQuery)}`;

    // const cachedData = await getCache(cacheKey);

    // if (cachedData) {
    //   return cachedData;
    // }

    // attendanceDate আর QueryBuilder-এ যাবে না
    const queryBuilder = new PrismaQueryBuilder(studentQuery)
      .search(["name", "studentId", "className"])
      .filter()
      .sort()
      .paginate();

    const queryOptions = queryBuilder.build();

    const classDistribution = await prisma.classDistribution.findFirst({
      where: {
        id: classDistributionId,
        teacherId,
        ...(classLevel ? { classLevel: String(classLevel) } : {}),
        ...(day ? { day: String(day) } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!classDistribution) {
      return {
        meta: {
          page: 1,
          limit: Number(studentQuery.limit) || 10,
          total: 0,
          totalPage: 0,
        },
        data: [],
      };
    }

    /**
     * Attendance Date Filter
     * - Strips accidental quotes/whitespace (e.g. `"2026-05-03"` sent as-is in a URL).
     * - Validates strict YYYY-MM-DD format before parsing.
     * - Always builds the day window in UTC (setUTCHours), matching how
     *   Prisma's DateTime is stored, so the filter doesn't drift by
     *   several hours depending on the server's local timezone.
     */
    let filterDate: Date;

    if (attendanceDate) {
      const rawValue = Array.isArray(attendanceDate)
        ? attendanceDate[0]
        : attendanceDate;

      // strip stray quotes / whitespace: `"2026-05-03"` -> `2026-05-03`
      const cleanedDate = String(rawValue).trim().replace(/^["']|["']$/g, "");

      const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(cleanedDate);

      if (!isValidFormat) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid attendanceDate: "${cleanedDate}". Expected format YYYY-MM-DD.`
        );
      }

      const parsed = new Date(`${cleanedDate}T00:00:00.000Z`);

      if (isNaN(parsed.getTime())) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid attendanceDate: "${cleanedDate}". Could not parse as a valid date.`
        );
      }

      filterDate = parsed;
    } else {
      filterDate = new Date();
      filterDate.setUTCHours(0, 0, 0, 0);
    }

    const nextDay = new Date(filterDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const whereCondition = {
      classDistributions: {
        some: {
          id: classDistributionId,
        },
      },
      ...(queryOptions.where || {}),
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
          studentId: true,
          className: true,
          photo: true,
          staffs: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          attendanceSheets: {
            where: {
              teacherId,
              AttendanceDate: {
                gte: filterDate,
                lt: nextDay,
              },
            },
            select: {
              id: true,
              AttendanceDate: true,
              attendanceStatus: true,
            },
            orderBy: {
              AttendanceDate: "desc",
            },
            take: 1,
          },
        },
      }),

      prisma.student.count({
        where: whereCondition,
      }),
    ]);

    const formattedStudents = students.map((student) => ({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      className: student.className,
      photo: student.photo,
      staffs: student.staffs,
      attendanceStatus:
        student.attendanceSheets.length > 0
          ? student.attendanceSheets[0].attendanceStatus
          : "ABSENT",
      attendanceDate:
        student.attendanceSheets.length > 0
          ? student.attendanceSheets[0].AttendanceDate
          : filterDate,
    }));

    const page = Number(studentQuery.page) || 1;
    const limit = Number(studentQuery.limit) || 10;

    const result = {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: formattedStudents,
    };

    // await setCache(cacheKey, result, 60 * 60);

    return result;
  } catch (error) {
    return catchError(
      error,
      "Error fetching student list for specific teacher"
    );
  }
};


const recordedStudentAttendanceOfTeachersIntoDb = async (
  teacherId: string,
  payload: RecordAttendancePayload
) => {
  try {
    const { attendanceDate, subscriptionId, students } = payload;

    const date = new Date(attendanceDate);
    date.setHours(0, 0, 0, 0);
    const existingStudents = await prisma.student.findMany({
      where: {
        studentId: { in: students.map((s) => s.studentId) },
        subscriptionId: subscriptionId, 
      },
      select: {
        id: true,
        studentId: true,
      },
    });

    const studentMap = new Map(
      existingStudents.map((s) => [s.studentId, s.id])
    );

    
    const existingAttendance = await prisma.attendanceSheet.findMany({
      where: {
        teacherId,
        AttendanceDate: date,
        studentId: {
          in: Array.from(studentMap.values()),
        },
      },
      select: {
        studentId: true,
      },
    });

    const existingStudentIds = new Set(
      existingAttendance.map((a) => a.studentId)
    );

  
    const newStudents = students.filter((s) => {
      const dbId = studentMap.get(s.studentId);
      return dbId && !existingStudentIds.has(dbId);
    });

    if (newStudents.length === 0) {
      return {
        success: false,
        message: "Attendance already recorded for all students today",
      };
    }

    const data = newStudents.map((s) => ({
      studentId: studentMap.get(s.studentId)!, 
      teacherId,
      subscriptionId,
      AttendanceDate: date,
      attendanceStatus: s.attendanceStatus,
    }));

    const result = await prisma.attendanceSheet.createMany({
      data,
      skipDuplicates: true,
    });

    return {
      success: true,
      message: "Attendance recorded successfully",
       insertedCount: result.count,
      skipped: existingStudentIds.size,
    };
  } catch (error) {
    return catchError(
      error,
      "Error recording student attendance for specific teacher"
    );
  }
};



const updateStudentAttendanceOfTeachersIntoDb = async (
  teacherId: string,
  subscriptionId: string,

  payload: RecordAttendancePayload
) => {
  try {
    const { attendanceDate,  students } = payload;

   
    const date = new Date(attendanceDate);
    date.setHours(0, 0, 0, 0);

    const existingStudents = await prisma.student.findMany({
      where: {
        studentId: { in: students.map((s) => s.studentId) },
        subscriptionId,
      },
      select: {
        id: true,        
        studentId: true, 
      },
    });

    const studentMap = new Map(
      existingStudents.map((s) => [s.studentId, s.id])
    );
    const invalidStudents = students.filter(
      (s) => !studentMap.has(s.studentId)
    );

    if (invalidStudents.length > 0) {
      return {
        success: false,
        message: "Invalid studentIds found",
        invalidStudents,
      };
    }
    const operations = students.map((s) => {
      const dbId = studentMap.get(s.studentId)!;

      return prisma.attendanceSheet.upsert({
        where: {
          studentId_AttendanceDate_teacherId: {
            studentId: dbId,
            AttendanceDate: date,
            teacherId,
          },
        },
        update: {
          attendanceStatus: s.attendanceStatus,
        },
        create: {
          teacherId,
          studentId: dbId,
          subscriptionId,
          AttendanceDate: date,
          attendanceStatus: s.attendanceStatus,
        },
      });
    });
    const result = await prisma.$transaction(operations);

    return {
      success: true,
      message: "Attendance updated successfully",
      totalProcessed: result.length,
    };
  } catch (error) {
    return catchError(
      error,
      "Error updating student attendance for specific teacher"
    );
  }
};

const teacherAttendanceDataIntoDb = async (
  teacherId: string,
  subscriptionId: string,
  query: Record<string, unknown>
) => {
  try {
    const { classLevel, day } = query;


    const cacheKey = `attendance:${teacherId}:${subscriptionId}:${classLevel || "all"}:${day || "all"}`;


    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return {
        success: true,
        data: cachedData,
        source: "cache", 
      };
    }

    const extraFilter: Record<string, any> = {};
    if (classLevel) extraFilter.classLevel = classLevel;
    if (day) extraFilter.day = day;

    const totalPresent = await prisma.attendanceSheet.count({
      where: {
        teacherId,
        subscriptionId,
        attendanceStatus: AttendanceStatus.PRESENT,
        ...extraFilter,
      },
    });

    const totalAbsent = await prisma.attendanceSheet.count({
      where: {
        teacherId,
        subscriptionId,
        attendanceStatus: AttendanceStatus.ABSENT,
        ...extraFilter,
      },
    });

    const resultData = {
      totalPresent,
      totalAbsent,
    };

    // ✅ Save to Redis (TTL 10 min)
    await setCache(cacheKey, resultData, 600);

    return {
      success: true,
      data: resultData,
      source: "db", 
    };
  } catch (error) {
    return catchError(
      error,
      "Error fetching attendance summary"
    );
  }
};

const onlineClassRecordedOfTeachersIntoDb = async (
  payload: Partial<ClassRecordedOfTeachers>,
  subscriptionId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const {  classDistributionId, link } = payload;

    if (!subscriptionId || !classDistributionId || !link) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "subscriptionId, classDistributionId and link are required"
      );
    }

    const isExistSubscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      select: { id: true },
    });

    if (!isExistSubscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    };


    
    const classData = await prisma.classDistribution.findUnique({
      where: { id: classDistributionId,isOnline:true, },
      
      select: {
         isOnline: true,
        students: {
          select: { id: true },
        },
      }
    });




    if(classData?.isOnline){
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Online class already recorded for this class distribution"
      );
    }

    if (!classData) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class distribution not found"
      );
    }

    // ✅ TRANSACTION START
    await prisma.$transaction(async (tx) => {
      // 1️⃣ Create online class
      const onlineClassRecord = await tx.onlineClass.create({
        data: {
          subscriptionId,
          classDistributionId,
          link,
        },
      });

      
      if (!onlineClassRecord) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to record online class"
        );
      }

  
      await tx.classDistribution.update({
        where: { id: classDistributionId },
        data: { isOnline: true },
      });

      // 3️⃣ Create notifications in bulk (BEST PRACTICE)
      if (classData.students?.length) {
        await tx.notification.createMany({
          data: classData.students.map((student) => ({
            title: "📢 Live Class Started",
            message: `Join your class now: ${link}`,
            studentId : student.id,
            subscriptionId,
          })),
        });
      }
    });
    
    const io = getSocketIO() as any;

    const notificationPayload = {
      id: Date.now(),
      title: "📢 Live Class Started",
      message: `Join your class now: ${link}`,
      createdBy: UserRole.TEACHER,
      timestamp: new Date().toISOString(),
      classDistributionId,
    };


    io.to(`class::${classDistributionId}`).emit(
      "notification",
      notificationPayload
    );

    if (classData.students?.length) {
      classData.students.forEach((student) => {
        io.to(`user::${student.id}`).emit(
          "notification",
          notificationPayload
        );
      });
    };

    return {
      success: true,
      message: "Online class created & notification sent",
    };
  } catch (error) {
    return catchError(error, "Error recording online class");
  }
};


const storeClassRecordingLinkOfTeachersIntoDb = async (
  payload: Partial<StoreClassRecording>
): Promise<{ success: boolean; message: string }> => {
  try {
    const { subscriptionId, classDistributionId, recordingUrl } = payload;

    
    if (!subscriptionId || !classDistributionId || !recordingUrl) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "subscriptionId, classDistributionId and recordingUrl are required"
      );
    }

   
    const isExistSubscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      select: { id: true },
    });

    if (!isExistSubscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    
    const classData = await prisma.classDistribution.findUnique({
      where: { id: classDistributionId },
      select: {
        id: true,
        isOnline: true,
        students: {
          select: { id: true },
        },
      },
    });

    if (!classData) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Class distribution not found"
      );
    }

    
    if (!classData.isOnline) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Class is not online"
      );
    }

    
    await prisma.$transaction(async (tx) => {
      // Save recording
      await tx.classRecording.create({
        data: {
          subscriptionId,
          classDistributionId,
          recordingUrl,
        },
      });

     
      if (classData.students?.length) {
        await tx.notification.createMany({
          data: classData.students.map((student) => ({
            title: "🎥 New Class Recording Available",
            message: `Your class recording is now available: ${recordingUrl}`,
            studentId: student.id,
            subscriptionId
          })),
        });
      }
    });

   
    const io = getSocketIO() as any;

    const notificationPayload = {
      id: Date.now(),
      title: "🎥 New Class Recording Available",
      message: `Your class recording is now available`,
      recordingUrl,
      timestamp: new Date().toISOString(),
      classDistributionId,
    };

  
    io.to(`class::${classDistributionId}`).emit(
      "notification",
      notificationPayload
    );

   
    if (classData.students?.length) {
      classData.students.forEach((student) => {
        io.to(`user::${student.id}`).emit(
          "notification",
          notificationPayload
        );
      });
    }


    return {
      success: true,
      message: "Class recording stored & notifications sent successfully",
    };
  } catch (error) {
    return catchError(error, "Error storing class recording link");
  }
};

const findBySpecificStudentClassRecordingOfTeachersIntoDb = async (
  teacherId: string,
  query: Record<string, unknown>
) => {
  try {
    const { classLevel, day } = query;

    const queryBuilder = new PrismaQueryBuilder(query)
      .search(teacherFilterableFields)
      .filter()
      .sort()
      .paginate();

    const { where, orderBy, skip, take } = queryBuilder.build();

    const extraFilters: Record<string, any> = {};
    if (classLevel) extraFilters.classLevel = classLevel;
    if (day) extraFilters.day = day;

    const whereCondition = {
      ...where,
      classDistribution: {
        teacherId,
        ...(Object.keys(extraFilters).length ? extraFilters : {}),
      },
    };

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    
    const cacheKey = `class-recordings:${teacherId}:${JSON.stringify(
      query
    )}`;

  
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return {
        success: true,
        message: "Class recordings fetched successfully (cached)",
        meta: cachedData.meta,
        data: cachedData.data,
      };
    }

   
    const result = await prisma.classRecording.findMany({
      where: whereCondition,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        recordingUrl: true,
        createdAt: true,
        updatedAt: true,

        classDistribution: {
          select: {
            id: true,
            classLevel: true,
assignableSubject: true,
            day: true,
            time: true,

          },
        },
      },
    });

    const total = await prisma.classRecording.count({
      where: whereCondition,
    });

    const response = {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: result,
    };

    // 3️⃣ SET CACHE (TTL: 5 minutes)
    await setCache(cacheKey, response, 300);

    return {
      ...response,
    };
  } catch (error) {
    return catchError(error, "Error fetching class recordings");
  }
};

const deleteClassRecordingLinkOfTeachersIntoDb = async (
  recordingId: string
): Promise<{ success: boolean; message: string }> => {
  try {
   
    const recording = await prisma.classRecording.findUnique({
      where: { id: recordingId },
      include: {
        classDistribution: {
          select: {
            id: true
          },
        },
      },
    });



    if (!recording) {
      throw new ApiError(httpStatus.NOT_FOUND, "Class recording not found");
    }

    const classDistributionId = recording.classDistributionId;

    // =========================
    // 2️⃣ SINGLE TRANSACTION (FIXED)
    // =========================
    await prisma.$transaction(async (tx) => {
      await tx.classDistribution.update({
        where: { id: classDistributionId },
        data: { isOnline: false },
      });

      await tx.classRecording.delete({
        where: { id: recordingId },
      });

    });

    return {
      success: true,
      message: "Class recording deleted successfully",
    };
  } catch (error) {
    return catchError(error, "Error deleting class recording");
  }
};

const deleteAllAttendanceIntoDb = async () => {
  try {
    console.log("api call")
    const result = await prisma.attendanceSheet.deleteMany({});
    console.log("result",result)

    return {
      success: true,
      message: "All attendance records deleted successfully.",
      deletedCount: result.count,
    };
  } catch (error) {
    throw catchError(error);
  }
}


const TeacherService = {
  createTeacherIntoDb,
  findByAllTeachersBranchAdminIntoDb,
  findBySingleTeacherIntoDb ,
  updateTeacherIntoDb,
   deleteTeacherFromDb,
   findByAllTeachers_Institutional_OwnerIntoDb,
   findBySpecificClassListOfTeachersIntoDb,
  findBySpecificStudentListOfTeachersIntoDb,
  findBySpecificStudentAttendanceOfTeachersIntoDb,
  recordedStudentAttendanceOfTeachersIntoDb,
  updateStudentAttendanceOfTeachersIntoDb,
   teacherAttendanceDataIntoDb ,
   onlineClassRecordedOfTeachersIntoDb,
   storeClassRecordingLinkOfTeachersIntoDb,
   findBySpecificStudentClassRecordingOfTeachersIntoDb ,
   deleteClassRecordingLinkOfTeachersIntoDb,
   deleteAllAttendanceIntoDb
};


export default TeacherService;