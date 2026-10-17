import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@workspace/db";
import { logger } from "../lib/logger";

const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "../../lib/db/migrations");

try {
  await migrate(db, { migrationsFolder });
  logger.info("Database migrations applied");
} catch (error) {
  const errorName =
    error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name
      : "UnknownError";
  logger.error({ errorName }, "Database migration failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
