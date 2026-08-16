import { z } from "zod";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "../models/job";
import { STAGES } from "../models/application";
import { ROLES } from "../models/user";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid id");

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(80),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(2).max(80),
  password: z.string().min(8).max(128),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default("RECRUITER"),
});

export const updateMemberSchema = z.object({
  role: z.enum(ROLES),
});

export const jobSchema = z.object({
  title: z.string().min(2).max(120),
  department: z.string().max(80).default(""),
  location: z.string().max(120).default(""),
  isRemote: z.boolean().default(false),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  description: z.string().min(20).max(20000),
  status: z.enum(JOB_STATUSES).default("DRAFT"),
});

export const updateJobSchema = jobSchema.partial();

export const jobListQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const applicationListQuerySchema = z.object({
  job: objectId.optional(),
  stage: z.enum(STAGES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const moveStageSchema = z.object({
  stage: z.enum(STAGES),
});

export const rateSchema = z.object({
  rating: z.coerce.number().min(0).max(5),
});

export const noteSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const applySchema = z.object({
  candidateName: z.string().min(2).max(120),
  candidateEmail: z.string().email(),
  candidatePhone: z.string().max(40).optional().default(""),
  coverLetter: z.string().max(5000).optional().default(""),
});

export const idParamSchema = z.object({ id: objectId });

export type RegisterInput = z.infer<typeof registerSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type ApplyInput = z.infer<typeof applySchema>;
