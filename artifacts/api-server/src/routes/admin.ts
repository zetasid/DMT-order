import { and, eq, ne, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateOperatorBody,
  CreateSellerBody,
  UpdateManagedUserStatusBody,
  UpdateManagedUserStatusParams,
  type CreateOperatorInput,
  type CreateSellerInput,
  type UpdateUserStatusInput,
} from "@workspace/api-zod";
import {
  accountStatusEnum,
  auditLogsTable,
  db,
  sessionsTable,
  tenantMembershipsTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import {
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
} from "../middlewares/authenticate";
import { validateBody } from "../middlewares/validate-body";
import { validateParams } from "../middlewares/validate-params";
import { hashPassword } from "../modules/auth/password";

const router: IRouter = Router();

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function getManagedUser(userId: string) {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      accountType: usersTable.accountType,
      status: usersTable.status,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), ne(usersTable.accountType, "owner")))
    .limit(1);

  if (!user) return undefined;

  const memberships = await db
    .select({
      tenantId: tenantsTable.id,
      tenantName: tenantsTable.name,
      tenantSlug: tenantsTable.slug,
      role: tenantMembershipsTable.role,
    })
    .from(tenantMembershipsTable)
    .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
    .where(eq(tenantMembershipsTable.userId, userId));

  return { ...user, memberships };
}

router.get("/admin/users", requireAuthenticated, requireOwner, async (_req, res, next) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        accountType: usersTable.accountType,
        status: usersTable.status,
        tenantId: tenantsTable.id,
        tenantName: tenantsTable.name,
        tenantSlug: tenantsTable.slug,
        role: tenantMembershipsTable.role,
      })
      .from(usersTable)
      .leftJoin(tenantMembershipsTable, eq(tenantMembershipsTable.userId, usersTable.id))
      .leftJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
      .where(ne(usersTable.accountType, "owner"))
      .orderBy(usersTable.createdAt);

    const byId = new Map<
      string,
      {
        id: string;
        email: string;
        displayName: string;
        accountType: "owner" | "member";
        status: "active" | "disabled";
        memberships: Array<{
          tenantId: string;
          tenantName: string;
          tenantSlug: string;
          role: "seller" | "operator";
        }>;
      }
    >();

    for (const row of users) {
      const current =
        byId.get(row.id) ??
        {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          accountType: row.accountType,
          status: row.status,
          memberships: [],
        };
      if (row.tenantId && row.tenantName && row.tenantSlug && row.role) {
        current.memberships.push({
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          tenantSlug: row.tenantSlug,
          role: row.role,
        });
      }
      byId.set(row.id, current);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ users: Array.from(byId.values()) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/admin/sellers",
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
  validateBody(CreateSellerBody),
  async (req, res, next) => {
    const actor = res.locals.actor;
    try {
      if (!actor) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const body = req.body as CreateSellerInput;
      const passwordHash = await hashPassword(body.password);
      const created = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(usersTable)
          .values({
            email: body.email.trim().toLowerCase(),
            displayName: body.displayName.trim(),
            passwordHash,
            accountType: "member",
            status: "active",
          })
          .returning();
        const [tenant] = await tx
          .insert(tenantsTable)
          .values({
            name: body.tenantName.trim(),
            slug: body.tenantSlug,
            sellerUserId: user.id,
          })
          .returning();
        await tx.insert(tenantMembershipsTable).values({
          tenantId: tenant.id,
          userId: user.id,
          role: "seller",
        });
        await tx.insert(auditLogsTable).values({
          actorUserId: actor.id,
          targetUserId: user.id,
          tenantId: tenant.id,
          action: "account.seller_created",
        });
        return { user, tenant };
      });

      res.status(201).json({
        user: {
          id: created.user.id,
          email: created.user.email,
          displayName: created.user.displayName,
          accountType: created.user.accountType,
          status: created.user.status,
          memberships: [
            {
              tenantId: created.tenant.id,
              tenantName: created.tenant.name,
              tenantSlug: created.tenant.slug,
              role: "seller",
            },
          ],
        },
        tenant: created.tenant,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Email or tenant slug already exists" });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/admin/operators",
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
  validateBody(CreateOperatorBody),
  async (req, res, next) => {
    const actor = res.locals.actor;
    try {
      if (!actor) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const body = req.body as CreateOperatorInput;
      const passwordHash = await hashPassword(body.password);
      const created = await db.transaction(async (tx) => {
        const [tenant] = await tx
          .select()
          .from(tenantsTable)
          .where(and(eq(tenantsTable.id, body.tenantId), eq(tenantsTable.status, "active")))
          .limit(1);
        if (!tenant) return undefined;

        const [user] = await tx
          .insert(usersTable)
          .values({
            email: body.email.trim().toLowerCase(),
            displayName: body.displayName.trim(),
            passwordHash,
            accountType: "member",
            status: "active",
          })
          .returning();
        await tx.insert(tenantMembershipsTable).values({
          tenantId: tenant.id,
          userId: user.id,
          role: "operator",
        });
        await tx.insert(auditLogsTable).values({
          actorUserId: actor.id,
          targetUserId: user.id,
          tenantId: tenant.id,
          action: "account.operator_created",
        });
        return { user, tenant };
      });

      if (!created) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }

      res.status(201).json({
        user: {
          id: created.user.id,
          email: created.user.email,
          displayName: created.user.displayName,
          accountType: created.user.accountType,
          status: created.user.status,
          memberships: [
            {
              tenantId: created.tenant.id,
              tenantName: created.tenant.name,
              tenantSlug: created.tenant.slug,
              role: "operator",
            },
          ],
        },
        tenant: null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }
      next(error);
    }
  },
);

router.patch(
  "/admin/users/:userId/status",
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
  validateParams(UpdateManagedUserStatusParams),
  validateBody(UpdateManagedUserStatusBody),
  async (req, res, next) => {
    const actor = res.locals.actor;
    try {
      if (!actor) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const body = req.body as UpdateUserStatusInput;
      const updated = await db.transaction(async (tx) => {
        const [user] = await tx
          .update(usersTable)
          .set({ status: body.status as (typeof accountStatusEnum.enumValues)[number], updatedAt: new Date() })
          .where(
            and(
              eq(usersTable.id, req.params.userId as string),
              ne(usersTable.accountType, "owner"),
            ),
          )
          .returning({
            id: usersTable.id,
            email: usersTable.email,
            displayName: usersTable.displayName,
            accountType: usersTable.accountType,
            status: usersTable.status,
          });
        if (!user) return undefined;

        if (user.status === "disabled") {
          await tx
            .delete(sessionsTable)
            .where(sql`${sessionsTable.sess} ->> 'userId' = ${user.id}`);
        }
        await tx.insert(auditLogsTable).values({
          actorUserId: actor.id,
          targetUserId: user.id,
          action: body.status === "disabled" ? "account.disabled" : "account.reactivated",
        });
        const memberships = await tx
          .select({
            tenantId: tenantsTable.id,
            tenantName: tenantsTable.name,
            tenantSlug: tenantsTable.slug,
            role: tenantMembershipsTable.role,
          })
          .from(tenantMembershipsTable)
          .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
          .where(eq(tenantMembershipsTable.userId, user.id));
        return { ...user, memberships };
      });

      if (!updated) {
        res.status(404).json({ error: "Managed user not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
