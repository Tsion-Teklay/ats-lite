import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../lib/errors";

type Source = "body" | "query" | "params";

export function validate<T>(schema: ZodType<T>, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // Query/params are read-only getters in Express 5-style typings; assign through a cast.
      (req as unknown as Record<Source, unknown>)[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(AppError.badRequest("Validation failed", error.issues));
        return;
      }
      next(error);
    }
  };
}
