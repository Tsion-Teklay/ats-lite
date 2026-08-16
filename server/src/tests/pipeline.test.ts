import request from "supertest";
import { app, addMember, applyToJob, createJob, registerOrg } from "./helpers";

describe("applications pipeline", () => {
  it("accepts a public application and records the initial stage", async () => {
    const org = await registerOrg();
    const job = await createJob(org);

    const response = await request(app).post(`/api/public/jobs/${job.id}/apply`).field({
      candidateName: "Abel Tesfaye",
      candidateEmail: "abel@example.com",
    });

    expect(response.status).toBe(201);

    const list = await request(app)
      .get("/api/applications")
      .set("Authorization", `Bearer ${org.accessToken}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].stage).toBe("APPLIED");
  });

  it("rejects a duplicate application to the same job", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    await applyToJob(job.id, "twice@example.com");

    const second = await request(app).post(`/api/public/jobs/${job.id}/apply`).field({
      candidateName: "Candidate Person",
      candidateEmail: "twice@example.com",
    });

    expect(second.status).toBe(409);
  });

  it("does not accept applications to draft jobs", async () => {
    const org = await registerOrg();
    const job = await createJob(org, { status: "DRAFT" });

    const response = await request(app).post(`/api/public/jobs/${job.id}/apply`).field({
      candidateName: "Candidate Person",
      candidateEmail: "draft@example.com",
    });

    expect(response.status).toBe(404);
  });

  it("appends to stage history and stamps hiredAt when moved to HIRED", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const applicationId = await applyToJob(job.id);

    for (const stage of ["SCREENING", "INTERVIEW", "OFFER", "HIRED"]) {
      const response = await request(app)
        .patch(`/api/applications/${applicationId}/stage`)
        .set("Authorization", `Bearer ${org.accessToken}`)
        .send({ stage });
      expect(response.status).toBe(200);
    }

    const detail = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set("Authorization", `Bearer ${org.accessToken}`);

    expect(detail.body.stage).toBe("HIRED");
    expect(detail.body.stageHistory.map((event: { stage: string }) => event.stage)).toEqual([
      "APPLIED",
      "SCREENING",
      "INTERVIEW",
      "OFFER",
      "HIRED",
    ]);
    expect(detail.body.hiredAt).toBeTruthy();
  });

  it("rejects an unknown stage", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const applicationId = await applyToJob(job.id);

    const response = await request(app)
      .patch(`/api/applications/${applicationId}/stage`)
      .set("Authorization", `Bearer ${org.accessToken}`)
      .send({ stage: "PROMOTED" });

    expect(response.status).toBe(400);
  });

  it("stores notes with their author", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const applicationId = await applyToJob(job.id);

    const response = await request(app)
      .post(`/api/applications/${applicationId}/notes`)
      .set("Authorization", `Bearer ${org.accessToken}`)
      .send({ body: "Strong portfolio, scheduling a call." });

    expect(response.status).toBe(201);
    expect(response.body.notes).toHaveLength(1);
    expect(response.body.notes[0].authorName).toBe("Owner Person");
  });

  it("filters applications by stage and searches by candidate", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const first = await applyToJob(job.id, "first@example.com");
    await applyToJob(job.id, "second@example.com");

    await request(app)
      .patch(`/api/applications/${first}/stage`)
      .set("Authorization", `Bearer ${org.accessToken}`)
      .send({ stage: "INTERVIEW" });

    const interviews = await request(app)
      .get("/api/applications?stage=INTERVIEW")
      .set("Authorization", `Bearer ${org.accessToken}`);
    expect(interviews.body.data).toHaveLength(1);

    const search = await request(app)
      .get("/api/applications?search=second@example.com")
      .set("Authorization", `Bearer ${org.accessToken}`);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].candidateEmail).toBe("second@example.com");
  });

  it("reports pipeline metrics from the dashboard aggregation", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const hired = await applyToJob(job.id, "hired@example.com");
    await applyToJob(job.id, "open@example.com");

    await request(app)
      .patch(`/api/applications/${hired}/stage`)
      .set("Authorization", `Bearer ${org.accessToken}`)
      .send({ stage: "HIRED" });

    const response = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${org.accessToken}`);

    expect(response.body.totals.applications).toBe(2);
    expect(response.body.totals.hired).toBe(1);
    expect(response.body.totals.inPipeline).toBe(1);
    expect(response.body.totals.hireRate).toBe(50);
    expect(response.body.stageCounts.HIRED).toBe(1);
    expect(response.body.topJobs[0].total).toBe(2);
  });
});

describe("role-based access control", () => {
  it("does not let a viewer create jobs or move candidates", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const applicationId = await applyToJob(job.id);
    const viewerToken = await addMember(org, "VIEWER");

    const created = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Nope", description: "A description long enough to pass validation." });
    expect(created.status).toBe(403);

    const moved = await request(app)
      .patch(`/api/applications/${applicationId}/stage`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ stage: "REJECTED" });
    expect(moved.status).toBe(403);

    const read = await request(app)
      .get("/api/applications")
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(read.status).toBe(200);
  });

  it("lets a recruiter manage the pipeline but not delete jobs or invite members", async () => {
    const org = await registerOrg();
    const job = await createJob(org);
    const applicationId = await applyToJob(job.id);
    const recruiterToken = await addMember(org, "RECRUITER");

    const moved = await request(app)
      .patch(`/api/applications/${applicationId}/stage`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ stage: "SCREENING" });
    expect(moved.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);
    expect(deleted.status).toBe(403);

    const invited = await request(app)
      .post("/api/team/invites")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ email: "someone@example.com", role: "RECRUITER" });
    expect(invited.status).toBe(403);
  });

  it("adds an invited member to the inviting organization only", async () => {
    const org = await registerOrg("Invite Co");
    const memberToken = await addMember(org, "RECRUITER");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${memberToken}`);
    expect(me.body.organization.id).toBe(org.organizationId);
    expect(me.body.user.role).toBe("RECRUITER");
  });
});
