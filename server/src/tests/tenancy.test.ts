import request from "supertest";
import { app, applyToJob, createJob, registerOrg } from "./helpers";

/**
 * The property that matters most in a multi-tenant app: organization A can never read
 * or mutate organization B's data, even with a valid token and a correct document id.
 */
describe("tenant isolation", () => {
  it("does not list another organization's jobs", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    await createJob(orgA, { title: "Only visible to A" });

    const response = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${orgB.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it("returns 404 when reading another organization's job by id", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    const job = await createJob(orgA);

    const response = await request(app)
      .get(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${orgB.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("refuses to update another organization's job", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    const job = await createJob(orgA);

    const response = await request(app)
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${orgB.accessToken}`)
      .send({ title: "Hijacked" });

    expect(response.status).toBe(404);

    const stillOwned = await request(app)
      .get(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${orgA.accessToken}`);
    expect(stillOwned.body.title).toBe("Frontend Engineer");
  });

  it("does not expose another organization's applications or move their stages", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    const job = await createJob(orgA);
    const applicationId = await applyToJob(job.id);

    const list = await request(app)
      .get("/api/applications")
      .set("Authorization", `Bearer ${orgB.accessToken}`);
    expect(list.body.data).toHaveLength(0);

    const move = await request(app)
      .patch(`/api/applications/${applicationId}/stage`)
      .set("Authorization", `Bearer ${orgB.accessToken}`)
      .send({ stage: "REJECTED" });
    expect(move.status).toBe(404);
  });

  it("keeps dashboard metrics scoped to the caller's organization", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    const job = await createJob(orgA);
    await applyToJob(job.id, "a1@example.com");
    await applyToJob(job.id, "a2@example.com");

    const dashboardA = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${orgA.accessToken}`);
    const dashboardB = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${orgB.accessToken}`);

    expect(dashboardA.body.totals.applications).toBe(2);
    expect(dashboardB.body.totals.applications).toBe(0);
  });

  it("only shows published jobs of the requested company on its career page", async () => {
    const orgA = await registerOrg("Org A");
    const orgB = await registerOrg("Org B");
    await createJob(orgA, { title: "A published role", status: "PUBLISHED" });
    await createJob(orgA, { title: "A draft role", status: "DRAFT" });
    await createJob(orgB, { title: "B published role", status: "PUBLISHED" });

    const response = await request(app).get(`/api/public/orgs/${orgA.slug}/jobs`);

    expect(response.status).toBe(200);
    expect(response.body.jobs.map((job: { title: string }) => job.title)).toEqual([
      "A published role",
    ]);
  });
});
