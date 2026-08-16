import type { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { Error as MongooseError } from "mongoose";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof MongooseError.ValidationError) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: error.message },
    });
    return;
  }

  if (error instanceof MongooseError.CastError) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: `Invalid value for ${error.path}` },
    });
    return;
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    res.status(409).json({
      error: { code: "CONFLICT", message: "That record already exists" },
    });
    return;
  }

  if (!env.isTest) {
    console.error(error);
  }

  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
