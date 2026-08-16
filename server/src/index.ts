import { createApp } from "./app";
import { env } from "./config/env";
import { connectDb } from "./db";

async function main(): Promise<void> {
  await connectDb();
  createApp().listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
