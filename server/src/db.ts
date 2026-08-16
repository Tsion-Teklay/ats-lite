import mongoose from "mongoose";
import { env } from "./config/env";

export async function connectDb(uri: string = env.mongoUri): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
