import axios, { AxiosError, type AxiosInstance } from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshRequest: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Share a single in-flight refresh so parallel 401s don't each rotate the cookie.
  refreshRequest ??= axios
    .post<{ accessToken: string }>(`${API_URL}/api/auth/refresh`, null, { withCredentials: true })
    .then((response) => response.data.accessToken)
    .catch(() => null)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const isAuthRoute = request?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && request && !request._retried && !isAuthRoute) {
      request._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        setAccessToken(token);
        request.headers.Authorization = `Bearer ${token}`;
        return api.request(request);
      }
      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { error?: { message?: string; details?: { message?: string }[] } }
      | undefined;
    const detail = data?.error?.details?.[0]?.message;
    return detail ? `${data?.error?.message}: ${detail}` : (data?.error?.message ?? error.message);
  }
  return fallback;
}

export function resumeUrl(filename: string): string {
  return `${API_URL}/uploads/${filename}`;
}
