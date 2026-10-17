import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  DeactivateTenantParams,
  UpdateTenantBody,
  UpdateTenantParams,
  GetTenantParams,
  type UpdateTenantInput,
} from "@workspace/api-zod";
import {
  auditLogsTable,
  db,
  tenantMembershipsTable,
  tenantsTable,
} from "@workspace/db";
import {
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
} from "../middlewares/authenticate";
import { validateBody } from "../middlewares/validate-body";
import { validateParams } from "../middlewares/validate-params";

const router: IRouter = Router();

async function findVisibleTenant(tenantId: string, actor: NonNullable<Express.Locals["actor"]>) {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  if (!tenant) return undefined;
  if (actor.accountType === "owner") return { tenant, membership: undefined };
  if (tenant.status !== "active") return undefined;

  const [membership] = await db
    .select()
    .from(tenantMembershipsTable)
    .where(
      and(
        eq(tenantMembershipsTable.tenantId, tenantId),
        eq(tenantMembershipsTable.userId, actor.id),
      ),
    )
    .limit(1);

  return membership ? { tenant, membership } : undefined;
}

router.get("/tenants", requireAuthenticated, async (_req, res, next) => {
  try {
    const actor = res.locals.actor;
    if (!actor) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const tenants =
      actor.accountType === "owner"
        ? await db.select().from(tenantsTable)
        : await db
            .select({
              id: tenantsTable.id,
              name: tenantsTable.name,
              slug: tenantsTable.slug,
              sellerUserId: tenantsTable.sellerUserId,
              status: tenantsTable.status,
              createdAt: tenantsTable.createdAt,
              updatedAt: tenantsTable.updatedAt,
            })
            .from(tenantMembershipsTable)
            .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
            .where(
              and(
                eq(tenantMembershipsTable.userId, actor.id),
                eq(tenantsTable.status, "active"),
              ),
            );
    res.setHeader("Cache-Control", "no-store");
    res.json({ tenants });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/tenants/:tenantId",
  requireAuthenticated,
  validateParams(GetTenantParams),
  async (req, res, next) => {
    try {
      const actor = res.locals.actor;
      if (!actor) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const visible = await findVisibleTenant(req.params.tenantId as string, actor);
      if (!visible) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(visible.tenant);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/tenants/:tenantId",
  requireAuthenticated,
  requireCsrfToken,
  validateParams(UpdateTenantParams),
  validateBody(UpdateTenantBody),
  async (req, res, next) => {
    try {
      const actor = res.locals.actor;
      if (!actor) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const visible = await findVisibleTenant(req.params.tenantId as string, actor);
      if (!visible) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }

      if (
        actor.accountType !== "owner" &&
        (visible.membership?.role !== "seller" ||
          visible.tenant.sellerUserId !== actor.id)
      ) {
        res.status(403).json({ error: "Seller role required" });
        return;
      }

      const body = req.body as UpdateTenantInput;
      const updated = await db.transaction(async (tx) => {
        const [tenant] = await tx
          .update(tenantsTable)
          .set({ name: body.name.trim(), updatedAt: new Date() })
          .where(eq(tenantsTable.id, visible.tenant.id))
          .returning();
        await tx.insert(auditLogsTable).values({
          actorUserId: actor.id,
          tenantId: visible.tenant.id,
          action: "tenant.updated",
        });
        return tenant;
      });

      if (!updated) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/tenants/:tenantId",
  requireAuthenticated,
  requireCsrfToken,
  requireOwner,
  validateParams(DeactivateTenantParams),
  async (req, res, next) => {
    try {
      const [tenant] = await db
        .update(tenantsTable)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(tenantsTable.id, req.params.tenantId as string))
        .returning({ id: tenantsTable.id });

      if (!tenant) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }

      await db.insert(auditLogsTable).values({
        actorUserId: res.locals.actor?.id,
        tenantId: tenant.id,
        action: "tenant.disabled",
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
