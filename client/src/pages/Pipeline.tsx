import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, apiErrorMessage, resumeUrl } from "../api/client";
import { useAuth } from "../auth/context";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Rating,
  Select,
  Spinner,
  StageBadge,
  Textarea,
} from "../components/ui";
import {
  STAGE_LABELS,
  STAGES,
  type Application,
  type Job,
  type Paginated,
  type Stage,
} from "../types";

function jobTitleOf(application: Application): string {
  return typeof application.job === "string" ? "—" : application.job.title;
}

export default function Pipeline() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFilter = searchParams.get("job") ?? "";
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["jobs", "all"],
    queryFn: async () => (await api.get<Paginated<Job>>("/jobs?limit=100")).data,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applications", jobFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (jobFilter) params.set("job", jobFilter);
      if (search) params.set("search", search);
      return (await api.get<Paginated<Application>>(`/applications?${params.toString()}`)).data;
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) =>
      (await api.patch<Application>(`/applications/${id}/stage`, { stage })).data,
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["application"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (caught) => setError(apiErrorMessage(caught, "Could not move this candidate")),
  });

  const canManage = can("OWNER", "RECRUITER");
  const applications = applicationsQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={
          canManage
            ? "Drag a candidate to another stage, or open a card to leave a note."
            : "Read-only view — ask an owner or recruiter to move candidates."
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="w-full sm:w-72">
          <Field label="Job">
            <Select
              value={jobFilter}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set("job", event.target.value);
                else next.delete("job");
                setSearchParams(next);
              }}
            >
              <option value="">All jobs</option>
              {jobsQuery.data?.data.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-full sm:w-72">
          <Field label="Search candidates">
            <Input
              placeholder="Name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>
        <p className="pb-2 text-sm text-slate-500">{applications.length} candidates</p>
      </Card>

      {applicationsQuery.isLoading ? <Spinner /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {STAGES.map((stage) => {
          const cards = applications.filter((application) => application.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(event) => {
                if (canManage && draggingId) event.preventDefault();
              }}
              onDrop={() => {
                if (!canManage || !draggingId) return;
                const dragged = applications.find((item) => item._id === draggingId);
                setDraggingId(null);
                if (dragged && dragged.stage !== stage) {
                  moveStage.mutate({ id: dragged._id, stage });
                }
              }}
              className="rounded-xl bg-slate-100/70 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{STAGE_LABELS[stage]}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {cards.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {cards.map((application) => (
                  <article
                    key={application._id}
                    draggable={canManage}
                    onDragStart={() => setDraggingId(application._id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setSelectedId(application._id)}
                    className={`cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 ${
                      draggingId === application._id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">{application.candidateName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{jobTitleOf(application)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Rating value={application.rating} readOnly />
                      {application.notes.length > 0 ? (
                        <span className="text-xs text-slate-400">{application.notes.length} notes</span>
                      ) : null}
                    </div>
                  </article>
                ))}

                {cards.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Empty
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedId ? (
        <CandidateModal
          applicationId={selectedId}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}

function CandidateModal({
  applicationId,
  canManage,
  onClose,
}: {
  applicationId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => (await api.get<Application>(`/applications/${applicationId}`)).data,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const addNote = useMutation({
    mutationFn: async (body: string) => api.post(`/applications/${applicationId}/notes`, { body }),
    onSuccess: () => {
      setNote("");
      invalidate();
    },
    onError: (caught) => setError(apiErrorMessage(caught, "Could not add the note")),
  });

  const setRating = useMutation({
    mutationFn: async (rating: number) => api.patch(`/applications/${applicationId}/rating`, { rating }),
    onSuccess: invalidate,
  });

  const setStage = useMutation({
    mutationFn: async (stage: Stage) => api.patch(`/applications/${applicationId}/stage`, { stage }),
    onSuccess: invalidate,
  });

  return (
    <Modal title={data?.candidateName ?? "Candidate"} onClose={onClose} wide>
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {error ? <Alert>{error}</Alert> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">{jobTitleOf(data)}</p>
              <p>
                <a className="text-brand-600 hover:underline" href={`mailto:${data.candidateEmail}`}>
                  {data.candidateEmail}
                </a>
                {data.candidatePhone ? ` · ${data.candidatePhone}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Applied {new Date(data.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <StageBadge stage={data.stage} />
              <Rating
                value={data.rating}
                readOnly={!canManage}
                onChange={(rating) => setRating.mutate(rating)}
              />
              {data.resumeFile ? (
                <a
                  className="text-sm font-medium text-brand-600 hover:underline"
                  href={resumeUrl(data.resumeFile)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.resumeOriginalName || "Download résumé"}
                </a>
              ) : (
                <span className="text-xs text-slate-400">No résumé uploaded</span>
              )}
            </div>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {STAGES.filter((stage) => stage !== data.stage).map((stage) => (
                <Button key={stage} variant="secondary" onClick={() => setStage.mutate(stage)}>
                  Move to {STAGE_LABELS[stage]}
                </Button>
              ))}
            </div>
          ) : null}

          {data.coverLetter ? (
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Cover letter</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{data.coverLetter}</p>
            </section>
          ) : null}

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Stage history</h3>
            <ol className="mt-2 space-y-1 text-sm text-slate-600">
              {data.stageHistory.map((event, index) => (
                <li key={`${event.stage}-${index}`} className="flex items-center gap-2">
                  <StageBadge stage={event.stage} />
                  <span className="text-xs text-slate-500">
                    {new Date(event.changedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
            <div className="mt-2 space-y-2">
              {data.notes.length === 0 ? (
                <p className="text-sm text-slate-500">No notes yet.</p>
              ) : (
                data.notes.map((item) => (
                  <div key={item._id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm text-slate-700">{item.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.authorName} · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            {canManage ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim()) addNote.mutate(note.trim());
                }}
              >
                <Textarea
                  rows={3}
                  placeholder="Add an interview note…"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button type="submit" disabled={addNote.isPending || note.trim().length === 0}>
                  {addNote.isPending ? "Saving…" : "Add note"}
                </Button>
              </form>
            ) : null}
          </section>
        </div>
      )}
    </Modal>
  );
}
