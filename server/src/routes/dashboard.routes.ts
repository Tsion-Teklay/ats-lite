import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { authContext, requireAuth } from "../middleware/auth";
import { ApplicationModel, OPEN_STAGES, STAGES } from "../models/application";
import { JobModel } from "../models/job";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

/**
 * All dashboard numbers come from three aggregation pipelines instead of loading
 * applications into Node and counting them there.
 */
dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { organizationId } = authContext(req);
    const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);

    const [stageRows, jobRows, weeklyRows, funnelRows, openJobs, publishedJobs] = await Promise.all([
      ApplicationModel.aggregate<{ _id: string; count: number }>([
        { $match: { organization: organizationId } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      ApplicationModel.aggregate<{
        _id: unknown;
        title: string;
        total: number;
        open: number;
        hired: number;
      }>([
        { $match: { organization: organizationId } },
        {
          $group: {
            _id: "$job",
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $in: ["$stage", OPEN_STAGES] }, 1, 0] } },
            hired: { $sum: { $cond: [{ $eq: ["$stage", "HIRED"] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: "jobs", localField: "_id", foreignField: "_id", as: "job" } },
        { $unwind: "$job" },
        { $project: { title: "$job.title", total: 1, open: 1, hired: 1 } },
      ]),
      ApplicationModel.aggregate<{ _id: string; count: number }>([
        { $match: { organization: organizationId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: { $dateTrunc: { date: "$createdAt", unit: "week" } } } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ApplicationModel.aggregate<{
        _id: null;
        total: number;
        hired: number;
        rejected: number;
        avgTimeToHireMs: number | null;
      }>([
        { $match: { organization: organizationId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            hired: { $sum: { $cond: [{ $eq: ["$stage", "HIRED"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$stage", "REJECTED"] }, 1, 0] } },
            avgTimeToHireMs: {
              $avg: {
                $cond: [
                  { $ne: ["$hiredAt", null] },
                  { $subtract: ["$hiredAt", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
      ]),
      JobModel.countDocuments({ organization: organizationId, status: { $ne: "CLOSED" } }),
      JobModel.countDocuments({ organization: organizationId, status: "PUBLISHED" }),
    ]);

    const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
      (typeof STAGES)[number],
      number
    >;
    for (const row of stageRows) {
      stageCounts[row._id as (typeof STAGES)[number]] = row.count;
    }

    const funnel = funnelRows[0];
    const total = funnel?.total ?? 0;
    const hired = funnel?.hired ?? 0;

    res.json({
      totals: {
        applications: total,
        hired,
        rejected: funnel?.rejected ?? 0,
        inPipeline: OPEN_STAGES.reduce((sum, stage) => sum + stageCounts[stage], 0),
        openJobs,
        publishedJobs,
        hireRate: total === 0 ? 0 : Number(((hired / total) * 100).toFixed(1)),
        avgTimeToHireDays:
          funnel?.avgTimeToHireMs == null
            ? null
            : Number((funnel.avgTimeToHireMs / (24 * 60 * 60 * 1000)).toFixed(1)),
      },
      stageCounts,
      topJobs: jobRows,
      weeklyApplications: weeklyRows.map((row) => ({ week: row._id, count: row.count })),
    });
  }),
);
