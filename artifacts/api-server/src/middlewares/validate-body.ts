import type { RequestHandler } from "express";

type BodySchema = {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | {
        success: false;
        error: {
          issues: readonly {
            path: readonly PropertyKey[];
            code: string;
          }[];
        };
      };
};

/**
 * Validate and replace an Express request body with parsed Zod data.
 * Route contracts should come from the generated OpenAPI schemas.
 */
export function validateBody(schema: BodySchema): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      req.log.warn(
        {
          issues: result.error.issues.map(({ path, code }) => ({ path, code })),
        },
        "Invalid request body",
      );
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    req.body = result.data;
    next();
  };
}
