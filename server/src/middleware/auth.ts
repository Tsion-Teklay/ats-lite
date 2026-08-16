import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";
import type { Role } from "../models/user";

export type AuthContext = {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: Role;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * Every authenticated request carries the tenant it belongs to. Route handlers must
 * read the organization from here and never from user-supplied input.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized());
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.auth = {
      userId: new Types.ObjectId(payload.sub),
      organizationId: new Types.ObjectId(payload.org),
      role: payload.role,
    };
    next();
  } catch {
    next(AppError.unauthorized("Access token is invalid or expired"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden(`This action requires one of: ${roles.join(", ")}`));
      return;
    }
    next();
  };
}

export function authContext(req: Request): AuthContext {
  if (!req.auth) {
    throw AppError.unauthorized();
  }
  return req.auth;
}
