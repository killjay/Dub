import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Either configure Neon/Postgres, or use the file-based fallback in waitlist code paths."
    );
  }
  if (!client) {
    // Single shared client; small pool for serverless.
    client = postgres(connectionString, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  }
  return drizzle(client, { schema });
}

export { schema };
