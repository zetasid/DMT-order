import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getDatabaseReadinessResult } from "../lib/database-readiness";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  const readiness = await getDatabaseReadinessResult(() =>
    pool.query("SELECT 1"),
  );
  res.status(readiness.statusCode).json(readiness.body);
});

export default router;
