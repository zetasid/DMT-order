import type { ErrorRequestHandler } from "express";

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const candidate =
    "statusCode" in error ? error.statusCode : "status" in error ? error.status : undefined;

  return typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate < 500
    ? candidate
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  req.log.error({ err: error }, "Unhandled API request error");
  const statusCode = getStatusCode(error) ?? 500;
  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error" : "Request failed",
  });
};
