import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", ["owner", "member"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "disabled"]);
export const membershipRoleEnum = pgEnum("membership_role", ["seller", "operator"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "disabled"]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    accountType: accountTypeEnum("account_type").notNull().default("member"),
    status: accountStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_single_owner_unique")
      .on(sql`(${table.accountType})`)
      .where(sql`${table.accountType} = 'owner'`),
  ],
);

export const tenantsTable = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 48 }).notNull(),
    sellerUserId: uuid("seller_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: tenantStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenants_slug_unique").on(table.slug),
    uniqueIndex("tenants_seller_user_unique").on(table.sellerUserId),
    index("tenants_status_idx").on(table.status),
  ],
);

export const tenantMembershipsTable = pgTable(
  "tenant_memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId] }),
    index("tenant_memberships_user_id_idx").on(table.userId),
    uniqueIndex("tenant_memberships_one_seller_tenant_unique")
      .on(table.userId)
      .where(sql`${table.role} = 'seller'`),
  ],
);

export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: jsonb("sess").notNull().$type<Record<string, unknown>>(),
    expire: timestamp("expire", { withTimezone: false }).notNull(),
  },
  (table) => [index("sessions_expire_idx").on(table.expire)],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    tenantId: uuid("tenant_id").references(() => tenantsTable.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_created_at_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_tenant_created_at_idx").on(table.tenantId, table.createdAt),
  ],
);

export type UserRecord = typeof usersTable.$inferSelect;
export type TenantRecord = typeof tenantsTable.$inferSelect;
export type TenantMembershipRecord = typeof tenantMembershipsTable.$inferSelect;
