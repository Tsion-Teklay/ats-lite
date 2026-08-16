import { Schema, model, type InferSchemaType, type HydratedDocument, type Types } from "mongoose";

export const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const;
export type Stage = (typeof STAGES)[number];

/** Stages a candidate can still progress through, in board order. */
export const OPEN_STAGES: Stage[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER"];

const noteSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const stageEventSchema = new Schema(
  {
    stage: { type: String, enum: STAGES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, lowercase: true, trim: true },
    candidatePhone: { type: String, trim: true, default: "" },
    coverLetter: { type: String, default: "" },
    resumeFile: { type: String, default: "" },
    resumeOriginalName: { type: String, default: "" },
    source: { type: String, trim: true, default: "CAREER_PAGE" },
    stage: { type: String, enum: STAGES, required: true, default: "APPLIED", index: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    stageHistory: { type: [stageEventSchema], default: [] },
    notes: { type: [noteSchema], default: [] },
    hiredAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One application per candidate email per job, scoped to the tenant.
applicationSchema.index({ organization: 1, job: 1, candidateEmail: 1 }, { unique: true });
applicationSchema.index({ organization: 1, stage: 1, updatedAt: -1 });
applicationSchema.index({ candidateName: "text", candidateEmail: "text" });

export type Application = InferSchemaType<typeof applicationSchema> & { _id: Types.ObjectId };
export type ApplicationDoc = HydratedDocument<Application>;

export const ApplicationModel = model("Application", applicationSchema);
