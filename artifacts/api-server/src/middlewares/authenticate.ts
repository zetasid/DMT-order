import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { usersTable, db } from "@workspace/db";
import type { AuthenticatedActor } from "../modules/auth/contracts";

declare global {
  namespace Express {
    interface Locals {
      actor?: AuthenticatedActor;
    }
  }
}

function destroySession(req: Express.Request): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
}

export const requireAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        accountType: usersTable.accountType,
        status: usersTable.status,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || user.status !== "active") {
      await destroySession(req);
      res.clearCookie("zetas.sid", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    res.locals.actor = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireOwner: RequestHandler = (_req, res, next) => {
  if (res.locals.actor?.accountType !== "owner") {
    res.status(403).json({ error: "Owner role required" });
    return;
  }
  next();
};

export const requireCsrfToken: RequestHandler = (req, res, next) => {
  const provided = req.get("x-csrf-token");
  const expected = req.session.csrfToken;

  if (
    !provided ||
    !expected ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
};
