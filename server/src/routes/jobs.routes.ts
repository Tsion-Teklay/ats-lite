import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { authContext, requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApplicationModel } from "../models/application";
import { JobModel } from "../models/job";
import { idParamSchema, jobListQuerySchema, jobSchema, updateJobSchema } from "../schemas";

export const jobsRouter = Router();

jobsRouter.use(requireAuth);

jobsRouter.get(
  "/",
  validate(jobListQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const { status, search, page, limit } = req.query as unknown as {
      status?: string;
      search?: string;
      page: number;
      limit: number;
    };

    const filter: Record<string, unknown> = { organization: organizationId };
    if (status) filter.status = status;
    if (search) filter.title = { $regex: search, $options: "i" };

    const [jobs, total] = await Promise.all([
      JobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      JobModel.countDocuments(filter),
    ]);

    // Application counts for the whole page in one round trip instead of N queries.
    const counts = await ApplicationModel.aggregate<{ _id: unknown; total: number; open: number }>([
      { $match: { organization: organizationId, job: { $in: jobs.map((job) => job._id) } } },
      {
        $group: {
          _id: "$job",
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $in: ["$stage", ["APPLIED", "SCREENING", "INTERVIEW", "OFFER"]] }, 1, 0] },
          },
        },
      },
    ]);
    const countsByJob = new Map(counts.map((row) => [String(row._id), row]));

    res.json({
      data: jobs.map((job) => ({
        ...job,
        applicationCount: countsByJob.get(String(job._id))?.total ?? 0,
        openApplicationCount: countsByJob.get(String(job._id))?.open ?? 0,
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  }),
);

jobsRouter.post(
  "/",
  requireRole("OWNER", "RECRUITER"),
  validate(jobSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, userId } = authContext(req);
    const job = await JobModel.create({
      ...req.body,
      organization: organizationId,
      createdBy: userId,
      publishedAt: req.body.status === "PUBLISHED" ? new Date() : null,
    });
    res.status(201).json(job.toObject());
  }),
);

jobsRouter.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const job = await JobModel.findOne({ _id: req.params.id, organization: organizationId }).lean();
    if (!job) throw AppError.notFound("Job not found");
    res.json(job);
  }),
);

jobsRouter.patch(
  "/:id",
  requireRole("OWNER", "RECRUITER"),
  validate(idParamSchema, "params"),
  validate(updateJobSchema),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const job = await JobModel.findOne({ _id: req.params.id, organization: organizationId });
    if (!job) throw AppError.notFound("Job not found");

    Object.assign(job, req.body);
    if (req.body.status === "PUBLISHED" && !job.publishedAt) {
      job.publishedAt = new Date();
    }
    await job.save();
    res.json(job.toObject());
  }),
);

jobsRouter.delete(
  "/:id",
  requireRole("OWNER"),
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const job = await JobModel.findOneAndDelete({
      _id: req.params.id,
      organization: organizationId,
    });
    if (!job) throw AppError.notFound("Job not found");
    await ApplicationModel.deleteMany({ organization: organizationId, job: job._id });
    res.status(204).end();
  }),
);
