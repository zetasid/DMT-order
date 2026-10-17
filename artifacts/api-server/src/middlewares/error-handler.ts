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

  const statusCode = getStatusCode(error) ?? 500;
  const errorName =
    error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name
      : "UnknownError";
  req.log.error({ statusCode, errorName }, "Unhandled API request error");
  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error" : "Request failed",
  });
};
