import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens";
import { uniqueSlug } from "../lib/slug";
import { authContext, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { InviteModel } from "../models/invite";
import { OrganizationModel } from "../models/organization";
import { UserModel, type UserDoc } from "../models/user";
import { acceptInviteSchema, loginSchema, registerSchema } from "../schemas";
import type { Response } from "express";

const REFRESH_COOKIE = "ats_refresh";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    maxAge: env.refreshTokenTtlMs,
    path: "/api/auth",
  });
}

function sessionResponse(user: UserDoc, organization: { _id: unknown; name: string; slug: string }) {
  return {
    accessToken: signAccessToken({
      sub: user._id.toString(),
      org: String(organization._id),
      role: user.role,
    }),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    organization: {
      id: String(organization._id),
      name: organization.name,
      slug: organization.slug,
    },
  };
}

export const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { organizationName, name, email, password } = req.body;

    if (await UserModel.exists({ email })) {
      throw AppError.conflict("An account with that email already exists");
    }

    const slug = await uniqueSlug(organizationName, async (candidate) =>
      Boolean(await OrganizationModel.exists({ slug: candidate })),
    );
    const organization = await OrganizationModel.create({ name: organizationName, slug });
    const user = await UserModel.create({
      organization: organization._id,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "OWNER",
      lastLoginAt: new Date(),
    });

    setRefreshCookie(res, signRefreshToken({ sub: user._id.toString(), version: user.tokenVersion }));
    res.status(201).json(sessionResponse(user, organization));
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw AppError.unauthorized("Incorrect email or password");
    }

    const organization = await OrganizationModel.findById(user.organization);
    if (!organization) {
      throw AppError.unauthorized("Organization no longer exists");
    }

    user.lastLoginAt = new Date();
    await user.save();

    setRefreshCookie(res, signRefreshToken({ sub: user._id.toString(), version: user.tokenVersion }));
    res.json(sessionResponse(user, organization));
  }),
);

authRouter.post(
  "/accept-invite",
  authLimiter,
  validate(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const { token, name, password } = req.body;
    const invite = await InviteModel.findOne({ tokenHash: hashToken(token), acceptedAt: null });
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest("This invitation is invalid or has expired");
    }
    if (await UserModel.exists({ email: invite.email })) {
      throw AppError.conflict("An account with that email already exists");
    }

    const organization = await OrganizationModel.findById(invite.organization);
    if (!organization) {
      throw AppError.badRequest("This invitation is no longer valid");
    }

    const user = await UserModel.create({
      organization: invite.organization,
      name,
      email: invite.email,
      passwordHash: await bcrypt.hash(password, 10),
      role: invite.role,
      lastLoginAt: new Date(),
    });
    invite.acceptedAt = new Date();
    await invite.save();

    setRefreshCookie(res, signRefreshToken({ sub: user._id.toString(), version: user.tokenVersion }));
    res.status(201).json(sessionResponse(user, organization));
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw AppError.unauthorized("No refresh token");
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw AppError.unauthorized("Refresh token is invalid or expired");
    }

    const user = await UserModel.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.version) {
      throw AppError.unauthorized("Session is no longer valid");
    }
    const organization = await OrganizationModel.findById(user.organization);
    if (!organization) {
      throw AppError.unauthorized("Organization no longer exists");
    }

    // Rotate on every refresh so a stolen cookie has a short useful life.
    setRefreshCookie(res, signRefreshToken({ sub: user._id.toString(), version: user.tokenVersion }));
    res.json(sessionResponse(user, organization));
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = authContext(req);
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.unauthorized();
    }
    const organization = await OrganizationModel.findById(user.organization);
    if (!organization) {
      throw AppError.unauthorized();
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
      },
    });
  }),
);
