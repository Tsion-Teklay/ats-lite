# ATS Lite — multi-tenant applicant tracking for small teams

A hiring tool small companies can actually run: create an organization, post jobs, get a public career
page, collect applications with résumés, and move candidates through a Kanban pipeline while a
dashboard summarises how hiring is going.

Built as a **MERN + TypeScript** application (MongoDB, Express, React, Node) with strict
organization-level data isolation, role-based access control, and MongoDB aggregation pipelines behind
every metric.

```
React 19 + Vite + TypeScript + Tailwind + TanStack Query
                │  JSON over HTTPS, bearer access token
Express 4 + TypeScript + Zod + JWT + Multer
                │  Mongoose
MongoDB (documents scoped by organizationId)
```

## Features

| Area | What it does |
| --- | --- |
| Multi-tenancy | Every document belongs to an organization; every query filters on the `organizationId` taken from the verified token — never from user input |
| Auth | Organization signup, login, short-lived JWT access token + rotating refresh token in an `HttpOnly` cookie, bcrypt password hashing, token versioning so sessions can be invalidated |
| Roles | `OWNER` (everything, incl. delete + invites), `RECRUITER` (jobs and pipeline), `VIEWER` (read-only) |
| Team | Owner creates invitations; the raw invite token is shown once and only its SHA-256 hash is stored |
| Jobs | Create, edit, publish, close, delete; search, status filter, pagination, per-job application counts |
| Career page | `/careers/:slug` lists a company's published jobs; job detail page accepts applications |
| Applications | Public application form with PDF/Word résumé upload (type + size validated), duplicate-application guard |
| Pipeline | Drag-and-drop board across Applied → Screening → Interview → Offer → Hired/Rejected, with full stage history, 1–5 ratings, and authored notes |
| Dashboard | Applications, in-pipeline count, hire rate, average time to hire, per-stage counts, busiest roles, 8-week trend — all computed by aggregation pipelines, not in Node |

Deliberately out of scope (kept as future work rather than half-built): email delivery, payments,
real-time updates, résumé parsing and AI screening.

## Demo credentials

`npm run seed` creates a demo organization (**Habesha Tech**, career page `/careers/habesha-tech`)
with 4 jobs and 18 candidates spread across the pipeline, plus a second organization whose data must
never appear in the first — a visible demonstration of tenant isolation.

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@demo.com` | `demo1234` |
| Recruiter | `recruiter@demo.com` | `demo1234` |
| Viewer | `viewer@demo.com` | `demo1234` |

## Run it locally

```bash
git clone https://github.com/Tsion-Teklay/ats-lite.git
cd ats-lite
npm install

cp server/.env.example server/.env      # set MONGO_URI and the two JWT secrets
cp client/.env.example client/.env.local

npm run seed        # demo organization + candidates
npm run dev         # API on :4000, web on :5173
```

Or with Docker (MongoDB, API and an nginx-served build):

```bash
docker compose up --build
docker compose exec api node -e "require('./dist/seed.js')"   # optional demo data
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API (tsx watch) + Vite dev server |
| `npm test` | Jest + Supertest against an in-memory MongoDB |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run lint` | ESLint (typescript-eslint) for both workspaces |
| `npm run build` | Compile the API and build the client bundle |
| `npm run seed` | Reset and load demo data |

## API

Authenticated routes expect `Authorization: Bearer <accessToken>`; `/api/public/*` is unauthenticated.

```
POST   /api/auth/register            create organization + owner
POST   /api/auth/login               → access token + refresh cookie
POST   /api/auth/accept-invite       join an organization with an invite token
POST   /api/auth/refresh             rotate the refresh cookie, issue an access token
POST   /api/auth/logout              clear the refresh cookie
GET    /api/auth/me                  current user + organization

GET    /api/jobs                     ?status= &search= &page= &limit=  (with application counts)
POST   /api/jobs                     OWNER, RECRUITER
GET    /api/jobs/:id
PATCH  /api/jobs/:id                 OWNER, RECRUITER
DELETE /api/jobs/:id                 OWNER

GET    /api/applications             ?job= &stage= &search= &page= &limit=
GET    /api/applications/:id
PATCH  /api/applications/:id/stage   OWNER, RECRUITER — appends stage history
PATCH  /api/applications/:id/rating  OWNER, RECRUITER
POST   /api/applications/:id/notes   OWNER, RECRUITER
DELETE /api/applications/:id         OWNER

GET    /api/dashboard                aggregated hiring metrics
GET    /api/team                     members + pending invitations
POST   /api/team/invites             OWNER
PATCH  /api/team/members/:id         OWNER
DELETE /api/team/members/:id         OWNER

GET    /api/public/orgs/:slug/jobs   published jobs of one company
GET    /api/public/jobs/:id          published job detail
POST   /api/public/jobs/:id/apply    multipart application + résumé
```

Errors are uniform: `{ "error": { "code", "message", "details?" } }`.

## Engineering decisions

**Tenant isolation is enforced in the query, not in a check.** The access token carries `sub`, `org`
and `role`; handlers read `req.auth.organizationId` and put it in the filter itself:

```ts
const job = await JobModel.findOne({ _id: req.params.id, organization: organizationId });
```

A caller who guesses another organization's document id gets a `404`, because the document does not
exist *for them*. The organization is never read from the request body or a query string, so there is
nothing to tamper with. Six tests assert this property across jobs, applications, dashboard metrics
and the public career page.

**Access token in memory, refresh token in an `HttpOnly` cookie.** The access token (15 min) never
touches `localStorage`, which keeps it out of reach of XSS; the refresh cookie is `HttpOnly`,
`SameSite`-restricted and scoped to `/api/auth`, so it is not sent to any other endpoint. Each user
row has a `tokenVersion` that invalidates issued refresh tokens. On the client a single shared
in-flight refresh promise prevents a burst of parallel 401s from rotating the cookie repeatedly.

**Aggregation instead of application-side counting.** The dashboard runs `$group`/`$facet`-style
pipelines (stage counts, top jobs, weekly trend, time-to-hire from stage history) in MongoDB, so the
API transfers a handful of numbers rather than every application document. Job listing similarly
resolves counts for the whole page in one aggregation instead of N queries.

**Stage history as an embedded array.** Candidate moves are appended as `{ stage, changedAt }`, which
gives an audit trail and lets average time-to-hire be derived from data already stored, without a
separate events collection.

**Indexes chosen from the actual queries.** Compound `{ organization, status, createdAt }` and
`{ organization, stage, updatedAt }` indexes match the list screens; a unique
`{ organization, job, candidateEmail }` index makes duplicate applications impossible at the database
level rather than only in a handler; text indexes back candidate and job search.

**Upload safety.** Résumés are limited to one file of ≤5 MB, restricted to PDF/Word MIME types, and
stored under a generated filename so a candidate cannot choose a path or extension.

**Invites store hashes.** Only the SHA-256 hash of an invitation token is persisted, so a database
dump cannot be replayed to join an organization. Delivery is by link (email is out of scope).

## Testing

25 Jest/Supertest tests run against `mongodb-memory-server`, covering registration and slug
collisions, login failures, refresh-cookie rotation, RBAC for all three roles, public application
submission (including duplicates and unpublished jobs), stage transitions with history, notes, search
and filtering, dashboard aggregation output, and — most importantly — cross-tenant access attempts.

```bash
npm test
```

GitHub Actions runs lint, typecheck, tests, the production build, and both Docker image builds on
every push and pull request.

## Roadmap

- Transactional email for invitations and candidate status updates
- Scheduling for interviews with calendar invites
- Résumé parsing and AI-assisted candidate screening (planned as a separate project)
- Audit log surfaced in the UI
- S3-compatible object storage for résumés instead of a local volume

## License

MIT
