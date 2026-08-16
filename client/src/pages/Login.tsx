import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/context";
import { Alert, Button, Card, Field, Input } from "../components/ui";

const DEMO = { email: "owner@demo.com", password: "demo1234" };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(credentials: { email: string; password: string }) {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(credentials.email, credentials.password);
      navigate("/app");
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not sign in"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in to ATS Lite</h1>
          <p className="mt-1 text-sm text-slate-500">Applicant tracking for small hiring teams.</p>
        </div>

        <Card className="p-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit({ email, password });
            }}
          >
            {error ? <Alert>{error}</Alert> : null}

            <Field label="Work email">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <Button variant="secondary" className="w-full" onClick={() => void submit(DEMO)}>
              Use the demo account
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">
              owner@demo.com · demo1234 (seeded data)
            </p>
          </div>
        </Card>

        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an organization
          </Link>
        </p>
      </div>
    </div>
  );
}
