export type Role = "OWNER" | "RECRUITER" | "VIEWER";

export type Stage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";

export const STAGES: Stage[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];

export const STAGE_LABELS: Record<Stage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export type JobStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type Session = {
  accessToken: string;
  user: SessionUser;
  organization: SessionOrganization;
};

export type Job = {
  _id: string;
  title: string;
  department: string;
  location: string;
  isRemote: boolean;
  employmentType: EmploymentType;
  description: string;
  status: JobStatus;
  publishedAt: string | null;
  createdAt: string;
  applicationCount?: number;
  openApplicationCount?: number;
};

export type Note = {
  _id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type StageEvent = {
  stage: Stage;
  changedAt: string;
};

export type Application = {
  _id: string;
  job: Pick<Job, "_id" | "title" | "department" | "location"> | string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  coverLetter: string;
  resumeFile: string;
  resumeOriginalName: string;
  stage: Stage;
  rating: number;
  notes: Note[];
  stageHistory: StageEvent[];
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type DashboardMetrics = {
  totals: {
    applications: number;
    hired: number;
    rejected: number;
    inPipeline: number;
    openJobs: number;
    publishedJobs: number;
    hireRate: number;
    avgTimeToHireDays: number | null;
  };
  stageCounts: Record<Stage, number>;
  topJobs: { _id: string; title: string; total: number; open: number; hired: number }[];
  weeklyApplications: { week: string; count: number }[];
};

export type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
};

export type PendingInvite = {
  _id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
};

export type PublicOrganization = {
  name: string;
  slug: string;
  about: string;
  location: string;
  website: string;
};
