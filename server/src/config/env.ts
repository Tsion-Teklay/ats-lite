import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isTest = process.env.NODE_ENV === "test";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: isTest
    ? (process.env.MONGO_URI ?? "")
    : required("MONGO_URI", "mongodb://127.0.0.1:27017/ats-lite"),
  accessTokenSecret: required("ACCESS_TOKEN_SECRET", isTest ? "test-access-secret" : undefined),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET", isTest ? "test-refresh-secret" : undefined),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? "7d",
  refreshTokenTtlMs: Number(process.env.REFRESH_TOKEN_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((o) => o.trim()),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")),
  publicApiUrl: process.env.PUBLIC_API_URL ?? "",
  maxResumeBytes: Number(process.env.MAX_RESUME_BYTES ?? 5 * 1024 * 1024),
};
