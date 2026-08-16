import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { authContext, requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApplicationModel } from "../models/application";
import { UserModel } from "../models/user";
import {
  applicationListQuerySchema,
  idParamSchema,
  moveStageSchema,
  noteSchema,
  rateSchema,
} from "../schemas";

export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

applicationsRouter.get(
  "/",
  validate(applicationListQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const { job, stage, search, page, limit } = req.query as unknown as {
      job?: string;
      stage?: string;
      search?: string;
      page: number;
      limit: number;
    };

    const filter: Record<string, unknown> = { organization: organizationId };
    if (job) filter.job = job;
    if (stage) filter.stage = stage;
    if (search) {
      filter.$or = [
        { candidateName: { $regex: search, $options: "i" } },
        { candidateEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [applications, total] = await Promise.all([
      ApplicationModel.find(filter)
        .populate("job", "title department location")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ApplicationModel.countDocuments(filter),
    ]);

    res.json({
      data: applications,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  }),
);

applicationsRouter.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const application = await ApplicationModel.findOne({
      _id: req.params.id,
      organization: organizationId,
    })
      .populate("job", "title department location employmentType")
      .lean();
    if (!application) throw AppError.notFound("Application not found");
    res.json(application);
  }),
);

applicationsRouter.patch(
  "/:id/stage",
  requireRole("OWNER", "RECRUITER"),
  validate(idParamSchema, "params"),
  validate(moveStageSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    const application = await ApplicationModel.findOne({
      _id: req.params.id,
      organization: organizationId,
    });
    if (!application) throw AppError.notFound("Application not found");

    const nextStage = req.body.stage;
    if (application.stage !== nextStage) {
      application.stage = nextStage;
      application.stageHistory.push({ stage: nextStage, changedBy: userId, changedAt: new Date() });
      application.hiredAt = nextStage === "HIRED" ? new Date() : null;
      application.rejectedAt = nextStage === "REJECTED" ? new Date() : null;
      await application.save();
    }

    res.json(application.toObject());
  }),
);

applicationsRouter.patch(
  "/:id/rating",
  requireRole("OWNER", "RECRUITER"),
  validate(idParamSchema, "params"),
  validate(rateSchema),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const application = await ApplicationModel.findOneAndUpdate(
      { _id: req.params.id, organization: organizationId },
      { rating: req.body.rating },
      { new: true },
    ).lean();
    if (!application) throw AppError.notFound("Application not found");
    res.json(application);
  }),
);

applicationsRouter.post(
  "/:id/notes",
  requireRole("OWNER", "RECRUITER"),
  validate(idParamSchema, "params"),
  validate(noteSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    const [application, author] = await Promise.all([
      ApplicationModel.findOne({ _id: req.params.id, organization: organizationId }),
      UserModel.findById(userId),
    ]);
    if (!application) throw AppError.notFound("Application not found");
    if (!author) throw AppError.unauthorized();

    application.notes.push({
      author: author._id,
      authorName: author.name,
      body: req.body.body,
      createdAt: new Date(),
    });
    await application.save();
    res.status(201).json(application.toObject());
  }),
);

applicationsRouter.delete(
  "/:id",
  requireRole("OWNER"),
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const deleted = await ApplicationModel.findOneAndDelete({
      _id: req.params.id,
      organization: organizationId,
    });
    if (!deleted) throw AppError.notFound("Application not found");
    res.status(204).end();
  }),
);
