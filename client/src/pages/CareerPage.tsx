import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Alert, Card, EmptyState, Spinner } from "../components/ui";
import { EMPLOYMENT_LABELS, type Job, type PublicOrganization } from "../types";

type CareerPageData = { organization: PublicOrganization; jobs: Job[] };

export default function CareerPage() {
  const { slug = "" } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["careers", slug],
    queryFn: async () => (await api.get<CareerPageData>(`/public/orgs/${slug}/jobs`)).data,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert>We could not find a company with that address.</Alert>
      </div>
    );
  }

  const { organization, jobs } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">We are hiring</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{organization.name}</h1>
        {organization.location ? (
          <p className="mt-1 text-sm text-slate-500">{organization.location}</p>
        ) : null}
        {organization.about ? (
          <p className="mt-4 max-w-2xl text-slate-600">{organization.about}</p>
        ) : null}
      </header>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Open roles</h2>

        {jobs.length === 0 ? (
          <EmptyState title="No open roles right now" hint="Check back soon." />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job._id} className="p-5 transition hover:border-brand-300">
                <Link to={`/careers/${slug}/jobs/${job._id}`} className="block">
                  <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {[job.department, job.isRemote ? "Remote" : job.location, EMPLOYMENT_LABELS[job.employmentType]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{job.description}</p>
                  <span className="mt-3 inline-block text-sm font-medium text-brand-600">
                    View role and apply →
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400">
        Careers page powered by ATS Lite.
      </footer>
    </div>
  );
}
