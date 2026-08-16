import { createContext, useContext } from "react";
import type { Role, SessionOrganization, SessionUser } from "../types";

export type AuthState = {
  user: SessionUser | null;
  organization: SessionOrganization | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  acceptInvite: (input: { token: string; name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
