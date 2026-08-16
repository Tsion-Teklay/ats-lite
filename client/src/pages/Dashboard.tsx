import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../auth/context";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import { STAGE_LABELS, STAGES, type DashboardMetrics } from "../types";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export default function Dashboard() {
  const { organization } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardMetrics>("/dashboard")).data,
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <Alert>Could not load dashboard metrics.</Alert>;

  const { totals, stageCounts, topJobs, weeklyApplications } = data;
  const maxStage = Math.max(1, ...STAGES.map((stage) => stageCounts[stage]));

  return (
    <>
      <PageHeader
        title={`${organization?.name ?? "Your team"} hiring overview`}
        subtitle="Every number here is computed by a MongoDB aggregation pipeline, scoped to your organization."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Applications" value={totals.applications} hint="All time" />
        <Stat label="In pipeline" value={totals.inPipeline} hint="Applied → Offer" />
        <Stat label="Hire rate" value={`${totals.hireRate}%`} hint={`${totals.hired} hired`} />
        <Stat
          label="Avg time to hire"
          value={totals.avgTimeToHireDays == null ? "—" : `${totals.avgTimeToHireDays} d`}
          hint={`${totals.publishedJobs} published jobs`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Candidates by stage</h2>
          <div className="mt-4 space-y-2.5">
            {STAGES.map((stage) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-20 text-xs text-slate-500">{STAGE_LABELS[stage]}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(stageCounts[stage] / maxStage) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium text-slate-700">
                  {stageCounts[stage]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Applications per week</h2>
          {weeklyApplications.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No applications in the last 8 weeks" />
            </div>
          ) : (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyApplications}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(week) => week.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b6cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Busiest roles</h2>
        {topJobs.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No applications yet" hint="Publish a job and share your career page." />
          </div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Role</th>
                <th className="py-2 text-right">Applications</th>
                <th className="py-2 text-right">Open</th>
                <th className="py-2 text-right">Hired</th>
              </tr>
            </thead>
            <tbody>
              {topJobs.map((job) => (
                <tr key={job._id} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{job.title}</td>
                  <td className="py-2 text-right">{job.total}</td>
                  <td className="py-2 text-right">{job.open}</td>
                  <td className="py-2 text-right">{job.hired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
