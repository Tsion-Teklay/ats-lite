import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "./db";
import { ApplicationModel, OPEN_STAGES, type Stage } from "./models/application";
import { InviteModel } from "./models/invite";
import { JobModel } from "./models/job";
import { OrganizationModel } from "./models/organization";
import { UserModel } from "./models/user";

const DEMO_PASSWORD = "demo1234";

const JOBS = [
  {
    title: "Frontend Engineer (React)",
    department: "Engineering",
    location: "Addis Ababa",
    isRemote: true,
    employmentType: "FULL_TIME" as const,
    status: "PUBLISHED" as const,
    description:
      "We are looking for a frontend engineer who is comfortable owning features end to end in React and TypeScript. You will work closely with design, ship weekly, and help us keep the interface fast and accessible.",
  },
  {
    title: "Backend Engineer (Node.js)",
    department: "Engineering",
    location: "Addis Ababa",
    isRemote: false,
    employmentType: "FULL_TIME" as const,
    status: "PUBLISHED" as const,
    description:
      "Join us to design and build the APIs behind our product. You will model data in MongoDB, write well-tested Express services, and take part in code review and on-call rotations.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote",
    isRemote: true,
    employmentType: "CONTRACT" as const,
    status: "PUBLISHED" as const,
    description:
      "Help us turn messy hiring workflows into interfaces people enjoy using. You will run discovery sessions, produce prototypes in Figma, and pair with engineers through implementation.",
  },
  {
    title: "Customer Success Associate",
    department: "Operations",
    location: "Addis Ababa",
    isRemote: false,
    employmentType: "PART_TIME" as const,
    status: "DRAFT" as const,
    description:
      "Be the first point of contact for our customers: onboarding new teams, answering questions, and channelling feedback to the product team so we build the right things.",
  },
];

const CANDIDATES = [
  "Abel Tesfaye",
  "Hanna Girma",
  "Yonas Bekele",
  "Selam Aweke",
  "Dawit Mekonnen",
  "Ruth Alemu",
  "Naod Haile",
  "Marta Kassa",
  "Kaleb Desta",
  "Bethel Tadesse",
  "Samuel Wolde",
  "Tigist Fikru",
  "Eyob Assefa",
  "Lidya Solomon",
  "Bereket Negash",
  "Meron Yohannes",
  "Amanuel Getachew",
  "Sara Teshome",
];

const STAGE_PLAN: Stage[] = [
  "APPLIED",
  "APPLIED",
  "APPLIED",
  "SCREENING",
  "SCREENING",
  "INTERVIEW",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
}

async function seed(): Promise<void> {
  await connectDb();

  await Promise.all([
    ApplicationModel.deleteMany({}),
    JobModel.deleteMany({}),
    UserModel.deleteMany({}),
    OrganizationModel.deleteMany({}),
    InviteModel.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const organization = await OrganizationModel.create({
    name: "Habesha Tech",
    slug: "habesha-tech",
    location: "Addis Ababa, Ethiopia",
    website: "https://example.com",
    about:
      "A small product team building tools for local businesses. We hire for curiosity and care about shipping things people actually use.",
  });

  const [owner] = await UserModel.create([
    {
      organization: organization._id,
      name: "Tsion Teklay",
      email: "owner@demo.com",
      passwordHash,
      role: "OWNER",
    },
    {
      organization: organization._id,
      name: "Recruiter Demo",
      email: "recruiter@demo.com",
      passwordHash,
      role: "RECRUITER",
    },
    {
      organization: organization._id,
      name: "Hiring Manager",
      email: "viewer@demo.com",
      passwordHash,
      role: "VIEWER",
    },
  ]);

  // A second tenant proves org-scoping in the demo: its data must never appear in Habesha Tech.
  const otherOrg = await OrganizationModel.create({
    name: "Blue Nile Logistics",
    slug: "blue-nile-logistics",
    location: "Bahir Dar, Ethiopia",
  });
  const otherOwner = await UserModel.create({
    organization: otherOrg._id,
    name: "Other Owner",
    email: "other@demo.com",
    passwordHash,
    role: "OWNER",
  });
  const otherJob = await JobModel.create({
    organization: otherOrg._id,
    title: "Logistics Coordinator",
    department: "Operations",
    location: "Bahir Dar",
    description:
      "Coordinate deliveries across the northern corridor, keep drivers informed, and maintain accurate records of every shipment.",
    status: "PUBLISHED",
    publishedAt: daysAgo(10),
    createdBy: otherOwner._id,
  });
  await ApplicationModel.create({
    organization: otherOrg._id,
    job: otherJob._id,
    candidateName: "Hidden Candidate",
    candidateEmail: "hidden@example.com",
    stage: "APPLIED",
    stageHistory: [{ stage: "APPLIED", changedAt: daysAgo(9) }],
  });

  const jobs = await JobModel.create(
    JOBS.map((job, index) => ({
      ...job,
      organization: organization._id,
      createdBy: owner._id,
      publishedAt: job.status === "PUBLISHED" ? daysAgo(40 - index * 5) : null,
      createdAt: daysAgo(45 - index * 5),
    })),
  );
  const publishedJobs = jobs.filter((job) => job.status === "PUBLISHED");

  const applications = CANDIDATES.map((name, index) => {
    const job = publishedJobs[index % publishedJobs.length];
    const stage = STAGE_PLAN[index % STAGE_PLAN.length];
    const appliedAt = daysAgo(35 - index);
    const history = [{ stage: "APPLIED" as Stage, changedAt: appliedAt }];

    const order: Stage[] = [...OPEN_STAGES, "HIRED", "REJECTED"];
    const target = order.indexOf(stage);
    for (let i = 1; i <= target; i += 1) {
      history.push({ stage: order[i], changedAt: daysAgo(35 - index - i * 3) });
    }

    return {
      organization: organization._id,
      job: job._id,
      candidateName: name,
      candidateEmail: emailFor(name),
      candidatePhone: `+2519${String(10000000 + index)}`,
      coverLetter: `I have been following ${organization.name} for a while and would love to contribute to the ${job.title} role.`,
      stage,
      rating: (index % 5) + 1,
      stageHistory: history,
      hiredAt: stage === "HIRED" ? daysAgo(35 - index - 12) : null,
      rejectedAt: stage === "REJECTED" ? daysAgo(35 - index - 6) : null,
      createdAt: appliedAt,
      notes:
        index % 3 === 0
          ? [
              {
                author: owner._id,
                authorName: owner.name,
                body: "Strong portfolio — moved to a short intro call.",
                createdAt: daysAgo(30 - index),
              },
            ]
          : [],
    };
  });

  await ApplicationModel.insertMany(applications);

  console.log("Seed complete.");
  console.log(`  Organization : ${organization.name} (/careers/${organization.slug})`);
  console.log(`  Owner        : owner@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  Recruiter    : recruiter@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  Viewer       : viewer@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  Jobs         : ${jobs.length} (${publishedJobs.length} published)`);
  console.log(`  Applications : ${applications.length}`);

  await disconnectDb();
}

seed().catch(async (error) => {
  console.error(error);
  await disconnectDb();
  process.exit(1);
});
