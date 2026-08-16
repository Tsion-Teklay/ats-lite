import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    website: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    about: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export type Organization = InferSchemaType<typeof organizationSchema>;
export type OrganizationDoc = HydratedDocument<Organization>;

export const OrganizationModel = model("Organization", organizationSchema);
