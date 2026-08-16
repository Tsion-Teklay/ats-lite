import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ROLES } from "./user";

const inviteSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "RECRUITER" },
    /** Hashed so a leaked database dump can't be used to join an organization. */
    tokenHash: { type: String, required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inviteSchema.index({ organization: 1, email: 1 });

export type Invite = InferSchemaType<typeof inviteSchema>;
export type InviteDoc = HydratedDocument<Invite>;

export const InviteModel = model("Invite", inviteSchema);
