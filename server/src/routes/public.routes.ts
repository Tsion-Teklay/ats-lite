import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { resumeUpload } from "../lib/upload";
import { validate } from "../middleware/validate";
import { ApplicationModel } from "../models/application";
import { JobModel } from "../models/job";
import { OrganizationModel } from "../models/organization";
import { applySchema, idParamSchema } from "../schemas";

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const publicRouter = Router();

/** Public career page: the company's published jobs, addressed by organization slug. */
publicRouter.get(
  "/orgs/:slug/jobs",
  asyncHandler(async (req, res) => {
    const organization = await OrganizationModel.findOne({ slug: req.params.slug.toLowerCase() }).lean();
    if (!organization) throw AppError.notFound("Company not found");

    const jobs = await JobModel.find({ organization: organization._id, status: "PUBLISHED" })
      .select("title department location isRemote employmentType description publishedAt")
      .sort({ publishedAt: -1 })
      .lean();

    res.json({
      organization: {
        name: organization.name,
        slug: organization.slug,
        about: organization.about,
        location: organization.location,
        website: organization.website,
      },
      jobs,
    });
  }),
);

publicRouter.get(
  "/jobs/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const job = await JobModel.findOne({ _id: req.params.id, status: "PUBLISHED" })
      .populate("organization", "name slug about location website")
      .lean();
    if (!job) throw AppError.notFound("Job not found");
    res.json(job);
  }),
);

publicRouter.post(
  "/jobs/:id/apply",
  applyLimiter,
  validate(idParamSchema, "params"),
  resumeUpload,
  validate(applySchema),
  asyncHandler(async (req, res) => {
    const job = await JobModel.findOne({ _id: req.params.id, status: "PUBLISHED" }).lean();
    if (!job) throw AppError.notFound("This job is no longer accepting applications");

    const existing = await ApplicationModel.findOne({
      organization: job.organization,
      job: job._id,
      candidateEmail: req.body.candidateEmail.toLowerCase(),
    }).lean();
    if (existing) {
      throw AppError.conflict("You have already applied to this role");
    }

    const application = await ApplicationModel.create({
      ...req.body,
      organization: job.organization,
      job: job._id,
      resumeFile: req.file?.filename ?? "",
      resumeOriginalName: req.file?.originalname ?? "",
      stage: "APPLIED",
      stageHistory: [{ stage: "APPLIED", changedAt: new Date() }],
    });

    res.status(201).json({
      id: application._id.toString(),
      candidateName: application.candidateName,
      jobTitle: job.title,
      submittedAt: application.createdAt,
    });
  }),
);
