import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { hashToken, randomToken } from "../lib/tokens";
import { authContext, requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { InviteModel } from "../models/invite";
import { UserModel } from "../models/user";
import { idParamSchema, inviteSchema, updateMemberSchema } from "../schemas";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const teamRouter = Router();

teamRouter.use(requireAuth);

teamRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const [members, invites] = await Promise.all([
      UserModel.find({ organization: organizationId })
        .select("name email role lastLoginAt createdAt")
        .sort({ createdAt: 1 })
        .lean(),
      InviteModel.find({ organization: organizationId, acceptedAt: null })
        .select("email role expiresAt createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.json({ members, invites });
  }),
);

teamRouter.post(
  "/invites",
  requireRole("OWNER"),
  validate(inviteSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    const { email, role } = req.body;

    if (await UserModel.exists({ email })) {
      throw AppError.conflict("That email is already registered");
    }

    // Only the raw token is returned (once) — the database stores its hash.
    const token = randomToken();
    await InviteModel.findOneAndUpdate(
      { organization: organizationId, email, acceptedAt: null },
      {
        organization: organizationId,
        email,
        role,
        tokenHash: hashToken(token),
        invitedBy: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      { upsert: true, new: true },
    );

    res.status(201).json({
      email,
      role,
      inviteToken: token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
  }),
);

teamRouter.patch(
  "/members/:id",
  requireRole("OWNER"),
  validate(idParamSchema, "params"),
  validate(updateMemberSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    if (req.params.id === userId.toString()) {
      throw AppError.badRequest("You cannot change your own role");
    }
    const member = await UserModel.findOneAndUpdate(
      { _id: req.params.id, organization: organizationId },
      { role: req.body.role },
      { new: true },
    )
      .select("name email role")
      .lean();
    if (!member) throw AppError.notFound("Member not found");
    res.json(member);
  }),
);

teamRouter.delete(
  "/members/:id",
  requireRole("OWNER"),
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    if (req.params.id === userId.toString()) {
      throw AppError.badRequest("You cannot remove yourself");
    }
    const member = await UserModel.findOneAndDelete({
      _id: req.params.id,
      organization: organizationId,
    });
    if (!member) throw AppError.notFound("Member not found");
    res.status(204).end();
  }),
);
