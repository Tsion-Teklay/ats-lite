import { Schema, model, type InferSchemaType, type HydratedDocument, type Types } from "mongoose";

export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const jobSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    isRemote: { type: Boolean, default: false },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: "FULL_TIME" },
    description: { type: String, required: true },
    status: { type: String, enum: JOB_STATUSES, required: true, default: "DRAFT", index: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Supports the org job list (the app's hottest read) and the public board.
jobSchema.index({ organization: 1, status: 1, createdAt: -1 });
jobSchema.index({ title: "text", description: "text", department: "text" });

export type Job = InferSchemaType<typeof jobSchema> & { _id: Types.ObjectId };
export type JobDoc = HydratedDocument<Job>;

export const JobModel = model("Job", jobSchema);
