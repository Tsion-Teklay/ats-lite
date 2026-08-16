import request from "supertest";
import { createApp } from "../app";
import type { Role } from "../models/user";
import { UserModel } from "../models/user";

export const app = createApp();

export type TestOrg = {
  accessToken: string;
  organizationId: string;
  userId: string;
  slug: string;
};

let counter = 0;

export async function registerOrg(organizationName = "Acme Inc"): Promise<TestOrg> {
  counter += 1;
  const email = `owner${counter}@example.com`;
  const response = await request(app).post("/api/auth/register").send({
    organizationName,
    name: "Owner Person",
    email,
    password: "password123",
  });

  if (response.status !== 201) {
    throw new Error(`registerOrg failed: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    accessToken: response.body.accessToken,
    organizationId: response.body.organization.id,
    userId: response.body.user.id,
    slug: response.body.organization.slug,
  };
}

/** Adds a member to an existing organization and returns their access token. */
export async function addMember(org: TestOrg, role: Role): Promise<string> {
  counter += 1;
  const email = `member${counter}@example.com`;

  const invite = await request(app)
    .post("/api/team/invites")
    .set("Authorization", `Bearer ${org.accessToken}`)
    .send({ email, role });

  const accepted = await request(app).post("/api/auth/accept-invite").send({
    token: invite.body.inviteToken,
    name: `Member ${counter}`,
    password: "password123",
  });

  if (accepted.status !== 201) {
    throw new Error(`addMember failed: ${accepted.status} ${JSON.stringify(accepted.body)}`);
  }
  return accepted.body.accessToken;
}

export async function createJob(
  org: TestOrg,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; body: Record<string, unknown> }> {
  const response = await request(app)
    .post("/api/jobs")
    .set("Authorization", `Bearer ${org.accessToken}`)
    .send({
      title: "Frontend Engineer",
      description: "A long enough description to satisfy validation rules for the job posting.",
      status: "PUBLISHED",
      ...overrides,
    });

  if (response.status !== 201) {
    throw new Error(`createJob failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { id: response.body._id, body: response.body };
}

export async function applyToJob(
  jobId: string,
  candidateEmail = "candidate@example.com",
): Promise<string> {
  const response = await request(app).post(`/api/public/jobs/${jobId}/apply`).field({
    candidateName: "Candidate Person",
    candidateEmail,
  });

  if (response.status !== 201) {
    throw new Error(`applyToJob failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id;
}

export async function countUsers(): Promise<number> {
  return UserModel.countDocuments({});
}
