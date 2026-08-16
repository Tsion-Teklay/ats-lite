import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/context";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../components/ui";
import type { PendingInvite, Role, TeamMember } from "../types";

const ROLE_HINTS: Record<Role, string> = {
  OWNER: "Full access, including billing-style actions: delete jobs, invite and remove members.",
  RECRUITER: "Can create and edit jobs, move candidates, leave notes.",
  VIEWER: "Read-only access to jobs and the pipeline.",
};

export default function Team() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("RECRUITER");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: async () =>
      (await api.get<{ members: TeamMember[]; invites: PendingInvite[] }>("/team")).data,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["team"] });

  const invite = useMutation({
    mutationFn: async () =>
      (await api.post<{ inviteToken: string }>("/team/invites", { email, role })).data,
    onSuccess: (data) => {
      setInviteToken(data.inviteToken);
      setEmail("");
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(apiErrorMessage(caught, "Could not send the invitation")),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, nextRole }: { id: string; nextRole: Role }) =>
      api.patch(`/team/members/${id}`, { role: nextRole }),
    onSuccess: invalidate,
    onError: (caught) => setError(apiErrorMessage(caught, "Could not update the role")),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: invalidate,
    onError: (caught) => setError(apiErrorMessage(caught, "Could not remove the member")),
  });

  const isOwner = can("OWNER");

  return (
    <>
      <PageHeader title="Team" subtitle="Roles decide what each teammate can do inside your organization." />

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {isOwner ? (
        <Card className="mb-6 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Invite a teammate</h2>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              invite.mutate();
            }}
          >
            <div className="w-full sm:w-72">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
            <div className="w-full sm:w-48">
              <Field label="Role">
                <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  <option value="RECRUITER">Recruiter</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="OWNER">Owner</option>
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? "Inviting…" : "Create invitation"}
            </Button>
          </form>

          <p className="mt-2 text-xs text-slate-500">{ROLE_HINTS[role]}</p>

          {inviteToken ? (
            <div className="mt-4">
              <Alert tone="success">
                <p className="font-medium">Invitation created.</p>
                <p className="mt-1">
                  Share this link — email delivery is intentionally out of scope for this project:
                </p>
                <code className="mt-2 block break-all rounded bg-white/60 px-2 py-1 text-xs">
                  {`${window.location.origin}/accept-invite?token=${inviteToken}`}
                </code>
              </Alert>
            </div>
          ) : null}
        </Card>
      ) : null}

      {teamQuery.isLoading ? <Spinner /> : null}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Last sign-in</th>
                {isOwner ? <th className="py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {teamQuery.data?.members.map((member) => (
                <tr key={member._id} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-slate-800">
                    {member.name}
                    {member._id === user?.id ? (
                      <span className="ml-2 text-xs text-slate-400">you</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-slate-600">{member.email}</td>
                  <td className="py-2.5">
                    {isOwner && member._id !== user?.id ? (
                      <Select
                        className="w-36"
                        value={member.role}
                        onChange={(event) =>
                          changeRole.mutate({ id: member._id, nextRole: event.target.value as Role })
                        }
                      >
                        <option value="OWNER">Owner</option>
                        <option value="RECRUITER">Recruiter</option>
                        <option value="VIEWER">Viewer</option>
                      </Select>
                    ) : (
                      <span className="text-slate-600">{member.role.toLowerCase()}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-slate-500">
                    {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : "—"}
                  </td>
                  {isOwner ? (
                    <td className="py-2.5 text-right">
                      {member._id === user?.id ? null : (
                        <Button
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            if (window.confirm(`Remove ${member.name}?`)) {
                              removeMember.mutate(member._id);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {teamQuery.data && teamQuery.data.invites.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Pending invitations</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {teamQuery.data.invites.map((pending) => (
                <li key={pending._id}>
                  {pending.email} · {pending.role.toLowerCase()} · expires{" "}
                  {new Date(pending.expiresAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </>
  );
}
