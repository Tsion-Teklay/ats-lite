import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { Alert, Button, Card, Field, Input, Spinner, Textarea } from "../components/ui";
import { EMPLOYMENT_LABELS, type Job, type PublicOrganization } from "../types";

type PublicJob = Omit<Job, "status"> & { organization: PublicOrganization };

export default function JobApply() {
  const { slug = "", jobId = "" } = useParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-job", jobId],
    queryFn: async () => (await api.get<PublicJob>(`/public/jobs/${jobId}`)).data,
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("submitting");
    try {
      await api.post(`/public/jobs/${jobId}/apply`, new FormData(event.currentTarget), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("done");
      formRef.current?.reset();
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not submit your application"));
      setStatus("idle");
    }
  }

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
        <Alert>This role is no longer open.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Link to={`/careers/${slug}`} className="text-sm text-brand-600 hover:underline">
        ← All roles at {data.organization.name}
      </Link>

      <header className="mt-4 border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900">{data.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[data.department, data.isRemote ? "Remote" : data.location, EMPLOYMENT_LABELS[data.employmentType]]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <article className="mt-6 whitespace-pre-line text-slate-700">{data.description}</article>

      <Card className="mt-8 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Apply for this role</h2>

        {status === "done" ? (
          <div className="mt-4">
            <Alert tone="success">
              Thanks — your application is in. The hiring team will reach out by email.
            </Alert>
          </div>
        ) : (
          <form ref={formRef} className="mt-4 space-y-4" onSubmit={submit} encType="multipart/form-data">
            {error ? <Alert>{error}</Alert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input name="candidateName" required minLength={2} />
              </Field>
              <Field label="Email">
                <Input name="candidateEmail" type="email" required />
              </Field>
            </div>

            <Field label="Phone (optional)">
              <Input name="candidatePhone" />
            </Field>

            <Field label="Résumé" hint="PDF or Word document, up to 5 MB.">
              <Input name="resume" type="file" accept=".pdf,.doc,.docx" />
            </Field>

            <Field label="Why are you a good fit? (optional)">
              <Textarea name="coverLetter" rows={5} />
            </Field>

            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
