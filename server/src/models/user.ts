import { Schema, model, type InferSchemaType, type HydratedDocument, type Types } from "mongoose";

export const ROLES = ["OWNER", "RECRUITER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "RECRUITER" },
    /** Bumped on password change or forced logout so outstanding refresh tokens stop working. */
    tokenVersion: { type: Number, required: true, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });

export type User = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserDoc = HydratedDocument<User>;

export const UserModel = model("User", userSchema);
