import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/context";
import { Alert, Button, Card, Field, Input } from "../components/ui";

export default function AcceptInvite() {
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    token: searchParams.get("token") ?? "",
    name: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptInvite(form);
      navigate("/app");
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not accept this invitation"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Join your team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste the invitation token you were given and pick a password.
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={submit}>
            {error ? <Alert>{error}</Alert> : null}

            <Field label="Invitation token">
              <Input
                required
                value={form.token}
                onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))}
              />
            </Field>
            <Field label="Your name">
              <Input
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Joining…" : "Join team"}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
