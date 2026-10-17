import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { LoginBody, type LoginInput } from "@workspace/api-zod";
import { auditLogsTable, db, tenantMembershipsTable, tenantsTable, usersTable } from "@workspace/db";
import { requireAuthenticated, requireCsrfToken } from "../middlewares/authenticate";
import { SESSION_COOKIE_NAME } from "../middlewares/session";
import { validateBody } from "../middlewares/validate-body";
import { verifyPasswordOrDummy } from "../modules/auth/password";

const router: IRouter = Router();

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts" },
});
const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip ?? "unknown");
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase().slice(0, 254)
        : "<invalid>";
    return `${ip}:${email}`;
  },
  message: { error: "Too many sign-in attempts" },
});

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

async function getUserForResponse(userId: string) {
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

  if (!user) return undefined;

  const memberships =
    user.accountType === "owner"
      ? []
      : await db
          .select({
            tenantId: tenantsTable.id,
            tenantName: tenantsTable.name,
            tenantSlug: tenantsTable.slug,
            role: tenantMembershipsTable.role,
          })
          .from(tenantMembershipsTable)
          .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
          .where(
            and(
              eq(tenantMembershipsTable.userId, userId),
              eq(tenantsTable.status, "active"),
            ),
          );

  return { ...user, memberships };
}

router.get("/auth/csrf", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = createCsrfToken();
  res.setHeader("Cache-Control", "no-store");
  res.json({ csrfToken: req.session.csrfToken });
});

router.post(
  "/auth/login",
  loginIpLimiter,
  loginAccountLimiter,
  requireCsrfToken,
  validateBody(LoginBody),
  async (req, res, next) => {
    try {
      const body = req.body as LoginInput;
      const email = body.email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${email}`)
        .limit(1);

      const passwordValid = await verifyPasswordOrDummy(body.password, user?.passwordHash);
      if (!user || !passwordValid || user.status !== "active") {
        res.status(401).json({ error: "Email or password is incorrect" });
        return;
      }

      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.csrfToken = createCsrfToken();
      await saveSession(req);

      const publicUser = await getUserForResponse(user.id);
      try {
        await db.insert(auditLogsTable).values({
          actorUserId: user.id,
          action: "auth.login_success",
        });
      } catch {
        req.log.error({ event: "auth.login_success" }, "Audit event could not be saved");
      }

      res.setHeader("Cache-Control", "no-store");
      res.json({ user: publicUser, csrfToken: req.session.csrfToken });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/auth/logout",
  requireCsrfToken,
  requireAuthenticated,
  async (req, res, next) => {
    const actor = res.locals.actor;
    try {
      await destroySession(req);
      if (actor) {
        try {
          await db.insert(auditLogsTable).values({
            actorUserId: actor.id,
            action: "auth.logout",
          });
        } catch {
          req.log.error({ event: "auth.logout" }, "Audit event could not be saved");
        }
      }

      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.get("/auth/me", requireAuthenticated, async (_req, res, next) => {
  try {
    const actor = res.locals.actor;
    if (!actor) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await getUserForResponse(actor.id);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
