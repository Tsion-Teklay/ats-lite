import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/context";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
} from "../components/ui";
import { EMPLOYMENT_LABELS, type EmploymentType, type Job, type JobStatus, type Paginated } from "../types";

type JobFormState = {
  title: string;
  department: string;
  location: string;
  isRemote: boolean;
  employmentType: EmploymentType;
  status: JobStatus;
  description: string;
};

const EMPTY_FORM: JobFormState = {
  title: "",
  department: "",
  location: "",
  isRemote: false,
  employmentType: "FULL_TIME",
  status: "DRAFT",
  description: "",
};

export default function Jobs() {
  const { can, organization } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"" | JobStatus>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Job | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["jobs", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      return (await api.get<Paginated<Job>>(`/jobs?${params.toString()}`)).data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveJob = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: JobFormState }) =>
      id
        ? (await api.patch<Job>(`/jobs/${id}`, values)).data
        : (await api.post<Job>("/jobs", values)).data,
    onSuccess: () => {
      setEditing(null);
      setIsCreating(false);
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(apiErrorMessage(caught, "Could not save the job")),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: invalidate,
    onError: (caught) => setError(apiErrorMessage(caught, "Could not delete the job")),
  });

  const canEdit = can("OWNER", "RECRUITER");

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Publish a role to make it visible on your public career page."
        actions={
          canEdit ? <Button onClick={() => setIsCreating(true)}>New job</Button> : undefined
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="w-full sm:w-64">
          <Field label="Search">
            <Input
              placeholder="Job title…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>
        <div className="w-full sm:w-44">
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | JobStatus)}
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </Field>
        </div>
      </Card>

      {jobsQuery.isLoading ? <Spinner /> : null}

      {jobsQuery.data && jobsQuery.data.data.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          hint={canEdit ? "Create your first role to start collecting applications." : undefined}
        />
      ) : null}

      <div className="grid gap-4">
        {jobsQuery.data?.data.map((job) => (
          <Card key={job._id} className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{job.title}</h2>
                <StatusBadge status={job.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {[job.department, job.isRemote ? "Remote" : job.location, EMPLOYMENT_LABELS[job.employmentType]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-slate-600">{job.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {job.applicationCount ?? 0} applications · {job.openApplicationCount ?? 0} in pipeline
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/app/pipeline?job=${job._id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
              >
                View pipeline
              </Link>
              {job.status === "PUBLISHED" && organization ? (
                <a
                  href={`/careers/${organization.slug}/jobs/${job._id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Public page
                </a>
              ) : null}
              {canEdit ? (
                <Button variant="secondary" onClick={() => setEditing(job)}>
                  Edit
                </Button>
              ) : null}
              {can("OWNER") ? (
                <Button
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm(`Delete "${job.title}" and its applications?`)) {
                      deleteJob.mutate(job._id);
                    }
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {isCreating || editing ? (
        <JobModal
          initial={editing ?? EMPTY_FORM}
          title={editing ? "Edit job" : "New job"}
          isSaving={saveJob.isPending}
          onClose={() => {
            setEditing(null);
            setIsCreating(false);
            setError(null);
          }}
          onSubmit={(values) => saveJob.mutate({ id: editing?._id, values })}
        />
      ) : null}
    </>
  );
}

function JobModal({
  initial,
  title,
  isSaving,
  onClose,
  onSubmit,
}: {
  initial: JobFormState | Job;
  title: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: JobFormState) => void;
}) {
  const [form, setForm] = useState<JobFormState>({
    title: initial.title,
    department: initial.department,
    location: initial.location,
    isRemote: initial.isRemote,
    employmentType: initial.employmentType,
    status: initial.status,
    description: initial.description,
  });

  return (
    <Modal title={title} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <Field label="Job title">
          <Input
            required
            minLength={2}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            <Input
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </Field>
          <Field label="Employment type">
            <Select
              value={form.employmentType}
              onChange={(event) =>
                setForm({ ...form, employmentType: event.target.value as EmploymentType })
              }
            >
              {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as JobStatus })}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isRemote}
            onChange={(event) => setForm({ ...form, isRemote: event.target.checked })}
          />
          This role is remote
        </label>

        <Field label="Description" hint="At least 20 characters — this is what candidates read.">
          <Textarea
            required
            minLength={20}
            rows={7}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save job"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
