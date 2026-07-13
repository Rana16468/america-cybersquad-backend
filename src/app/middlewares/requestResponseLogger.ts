import { NextFunction, Request, Response } from "express";
import { logger } from "../../config/logger";

const sensitiveKeys = new Set([
  "password",
  "confirmPassword",
  "oldPassword",
  "newPassword",
  "oldpassword",
  "newpassword",
  "refreshToken",
  "token",
]);

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entryValue]) => {
        acc[key] = sensitiveKeys.has(key) ? "[REDACTED]" : sanitize(entryValue);
        return acc;
      },
      {}
    );
  }

  return value;
};

const requestResponseLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  // logger.info(
  //   {
  //     type: "request",
  //     req: {
  //       method: req.method,
  //       url: req.originalUrl,
  //       ip: req.ip,
  //       params: sanitize(req.params),
  //       query: sanitize(req.query),
  //       body: sanitize(req.body),
  //     },
  //   },
  //   "Incoming request"
  // );

  res.on("finish", () => {
    // logger.info(
    //   {
    //     type: "response",
    //     req: {
    //       method: req.method,
    //       url: req.originalUrl,
    //     },
    //     response: {
    //       statusCode: res.statusCode,
    //       durationMs: Date.now() - startedAt,
    //       body: sanitize(res.locals.responseBody),
    //     },
    //   },
    //   "Outgoing response"
    // );
  });

  next();
};

export default requestResponseLogger;
