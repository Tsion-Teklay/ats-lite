import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, setSessionExpiredHandler } from "../api/client";
import type { Session, SessionOrganization, SessionUser } from "../types";
import { AuthContext, type AuthState } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [organization, setOrganization] = useState<SessionOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session: Session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setOrganization(session.organization);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setOrganization(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    // On boot the access token lives only in memory, so ask the refresh cookie for a new one.
    let cancelled = false;
    api
      .post<Session>("/auth/refresh")
      .then(({ data }) => {
        if (!cancelled) applySession(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      organization,
      isLoading,
      login: async (email, password) => {
        const { data } = await api.post<Session>("/auth/login", { email, password });
        applySession(data);
      },
      register: async (input) => {
        const { data } = await api.post<Session>("/auth/register", input);
        applySession(data);
      },
      acceptInvite: async (input) => {
        const { data } = await api.post<Session>("/auth/accept-invite", input);
        applySession(data);
      },
      logout: async () => {
        await api.post("/auth/logout").catch(() => undefined);
        clearSession();
      },
      can: (...roles) => (user ? roles.includes(user.role) : false),
    }),
    [applySession, clearSession, isLoading, organization, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
