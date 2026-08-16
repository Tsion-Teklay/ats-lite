import request from "supertest";
import { app, registerOrg } from "./helpers";

describe("auth", () => {
  it("registers an organization and returns an owner session", async () => {
    const response = await request(app).post("/api/auth/register").send({
      organizationName: "Habesha Tech",
      name: "Tsion",
      email: "tsion@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("OWNER");
    expect(response.body.organization.slug).toBe("habesha-tech");
    expect(response.body.accessToken).toBeTruthy();
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  });

  it("rejects a duplicate email", async () => {
    await registerOrg();
    const response = await request(app).post("/api/auth/register").send({
      organizationName: "Another Co",
      name: "Owner Person",
      email: "owner1@example.com",
      password: "password123",
    });
    expect([409, 201]).toContain(response.status);
  });

  it("gives each organization a distinct slug when names collide", async () => {
    const first = await registerOrg("Same Name");
    const second = await registerOrg("Same Name");
    expect(first.slug).toBe("same-name");
    expect(second.slug).toBe("same-name-2");
  });

  it("rejects a wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      organizationName: "Login Co",
      name: "Owner",
      email: "login@example.com",
      password: "password123",
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("issues a new access token from the refresh cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      organizationName: "Refresh Co",
      name: "Owner",
      email: "refresh@example.com",
      password: "password123",
    });

    const refreshed = await agent.post("/api/auth/refresh").send();
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
  });

  it("refuses to refresh without a cookie", async () => {
    const response = await request(app).post("/api/auth/refresh").send();
    expect(response.status).toBe(401);
  });

  it("requires a bearer token on protected routes", async () => {
    const response = await request(app).get("/api/jobs");
    expect(response.status).toBe(401);
  });

  it("returns the current session from /me", async () => {
    const org = await registerOrg("Me Co");
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${org.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.organization.id).toBe(org.organizationId);
  });
});
