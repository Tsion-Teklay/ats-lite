import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { env } from "../config/env";
import { AppError } from "./errors";
import { randomToken } from "./tokens";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

fs.mkdirSync(env.uploadDir, { recursive: true });

export const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, env.uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${randomToken(8)}${ext}`);
    },
  }),
  limits: { fileSize: env.maxResumeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(AppError.badRequest("Résumé must be a PDF or Word document"));
      return;
    }
    cb(null, true);
  },
}).single("resume");
