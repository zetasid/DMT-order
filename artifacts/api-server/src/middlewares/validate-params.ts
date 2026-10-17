import type { RequestHandler } from "express";

type ParamsSchema = {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | { success: false };
};

export function validateParams(schema: ParamsSchema): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ error: "Invalid path parameter" });
      return;
    }
    req.params = result.data as typeof req.params;
    next();
  };
}
