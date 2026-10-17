import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { eq, or } from "drizzle-orm";
import app from "../app";
import {
  auditLogsTable,
  db,
  pool,
  sessionsTable,
  tenantMembershipsTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "../modules/auth/password";

const TEST_PASSWORD = "Zetas-Test-Only-Password-2026!";

type ApiResult = {
  response: Response;
  data?: Record<string, unknown>;
};

class ApiClient {
  cookie = "";
  csrfToken = "";
  readonly sessionIds = new Set<string>();

  constructor(private readonly forwardedHttps = false) {}

  private captureCookie(response: Response): void {
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) return;
    this.cookie = setCookie.split(";", 1)[0] ?? "";
    const rawValue = this.cookie.split("=", 2)[1] ?? "";
    const decodedValue = decodeURIComponent(rawValue);
    if (!decodedValue.startsWith("s:")) return;
    const signedId = decodedValue.slice(2);
    const signatureSeparator = signedId.lastIndexOf(".");
    if (signatureSeparator > 0) {
      this.sessionIds.add(signedId.slice(0, signatureSeparator));
    }
  }

  async request(
    baseUrl: string,
    path: string,
    options: {
      method?: string;
      body?: unknown;
      includeCsrf?: boolean;
    } = {},
  ): Promise<ApiResult> {
    const method = options.method ?? "GET";
    const headers = new Headers();
    if (this.cookie) headers.set("cookie", this.cookie);
    if (this.forwardedHttps) headers.set("x-forwarded-proto", "https");
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (
      options.includeCsrf !== false &&
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      this.csrfToken
    ) {
      headers.set("x-csrf-token", this.csrfToken);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    this.captureCookie(response);

    let data: Record<string, unknown> | undefined;
    if (response.status !== 204) {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    }
    if (data && typeof data.csrfToken === "string") this.csrfToken = data.csrfToken;
    return { response, data };
  }

  async prepareCsrf(baseUrl: string): Promise<void> {
    const result = await this.request(baseUrl, "/api/auth/csrf");
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get("cache-control") ?? "", /no-store/i);
    assert.equal(typeof result.data?.csrfToken, "string");
    this.csrfToken = result.data?.csrfToken as string;
  }

  async login(baseUrl: string, email: string, password: string): Promise<ApiResult> {
    await this.prepareCsrf(baseUrl);
    return this.request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
  }
}

test(
  "sessions, role authorization, tenant isolation, input validation, and logout",
  { timeout: 120_000 },
  async (t) => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Auth integration tests refuse to run with NODE_ENV=production.");
    }

    const existingOwners = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.accountType, "owner"))
      .limit(1);
    if (existingOwners.length) {
      throw new Error("Use a dedicated development/test database with no existing Owner for auth tests.");
    }

    const suffix = randomUUID();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const userIds: string[] = [];
    const tenantIds: string[] = [];
    const sessionIds = new Set<string>();
    const clients: Record<string, ApiClient> = {};
    const allClients: ApiClient[] = [];
    const createClient = () => {
      const client = new ApiClient();
      allClients.push(client);
      return client;
    };

    const fixtures = await db.transaction(async (tx) => {
      const [owner] = await tx
        .insert(usersTable)
        .values({
          email: `zetas-test-owner-${suffix}@example.test`,
          displayName: "Integration Test Owner",
          accountType: "owner",
          passwordHash,
        })
        .returning();
      const [sellerA] = await tx
        .insert(usersTable)
        .values({
          email: `zetas-test-seller-a-${suffix}@example.test`,
          displayName: "Integration Seller A",
          passwordHash,
        })
        .returning();
      const [sellerB] = await tx
        .insert(usersTable)
        .values({
          email: `zetas-test-seller-b-${suffix}@example.test`,
          displayName: "Integration Seller B",
          passwordHash,
        })
        .returning();
      const [operatorA] = await tx
        .insert(usersTable)
        .values({
          email: `zetas-test-operator-a-${suffix}@example.test`,
          displayName: "Integration Operator A",
          passwordHash,
        })
        .returning();
      const [tenantA] = await tx
        .insert(tenantsTable)
        .values({
          name: "Integration Tenant A",
          slug: `test-a-${suffix.slice(0, 12)}`,
          sellerUserId: sellerA.id,
        })
        .returning();
      const [tenantB] = await tx
        .insert(tenantsTable)
        .values({
          name: "Integration Tenant B",
          slug: `test-b-${suffix.slice(0, 12)}`,
          sellerUserId: sellerB.id,
        })
        .returning();
      await tx.insert(tenantMembershipsTable).values([
        { tenantId: tenantA.id, userId: sellerA.id, role: "seller" },
        { tenantId: tenantB.id, userId: sellerB.id, role: "seller" },
        { tenantId: tenantA.id, userId: operatorA.id, role: "operator" },
      ]);
      return { owner, sellerA, sellerB, operatorA, tenantA, tenantB };
    });

    userIds.push(
      fixtures.owner.id,
      fixtures.sellerA.id,
      fixtures.sellerB.id,
      fixtures.operatorA.id,
    );
    tenantIds.push(fixtures.tenantA.id, fixtures.tenantB.id);

    const server = app.listen(0);
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      await t.test("Private API endpoints reject unauthenticated requests", async () => {
        const anonymous = createClient();
        const protectedRequests: Array<{
          method: string;
          path: string;
          body?: Record<string, unknown>;
        }> = [
          { method: "GET", path: "/api/auth/me" },
          { method: "POST", path: "/api/auth/logout" },
          { method: "GET", path: "/api/tenants" },
          { method: "GET", path: `/api/tenants/${fixtures.tenantA.id}` },
          { method: "PATCH", path: `/api/tenants/${fixtures.tenantA.id}`, body: { name: "No session" } },
          { method: "DELETE", path: `/api/tenants/${fixtures.tenantA.id}` },
          { method: "GET", path: "/api/admin/users" },
          { method: "POST", path: "/api/admin/sellers", body: {} },
          { method: "POST", path: "/api/admin/operators", body: {} },
          {
            method: "PATCH",
            path: `/api/admin/users/${fixtures.sellerA.id}/status`,
            body: { status: "disabled" },
          },
        ];
        for (const endpoint of protectedRequests) {
          const result = await anonymous.request(baseUrl, endpoint.path, {
            method: endpoint.method,
            body: endpoint.body,
          });
          assert.ok(
            result.response.status === 401 || result.response.status === 403,
            `${endpoint.method} ${endpoint.path} unexpectedly returned ${result.response.status}`,
          );
        }

        assert.equal((await anonymous.request(baseUrl, "/api/healthz")).response.status, 200);
        assert.equal((await anonymous.request(baseUrl, "/api/auth/csrf")).response.status, 200);
      });

      await t.test("Owner can authenticate and sees all tenants", async () => {
        const ownerClient = new ApiClient(true);
        allClients.push(ownerClient);
        clients.owner = ownerClient;
        const login = await ownerClient.login(
          baseUrl,
          fixtures.owner.email,
          TEST_PASSWORD,
        );
        assert.equal(login.response.status, 200);
        assert.equal(login.data?.user && typeof login.data.user, "object");
        assert.equal(
          "passwordHash" in (login.data?.user as Record<string, unknown>),
          false,
        );
        assert.match(login.response.headers.get("set-cookie") ?? "", /HttpOnly/i);
        assert.match(login.response.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
        assert.match(login.response.headers.get("set-cookie") ?? "", /Secure/i);
        assert.ok(ownerClient.sessionIds.size >= 2, "login must rotate the session ID");

        const tenants = await ownerClient.request(baseUrl, "/api/tenants");
        assert.equal(tenants.response.status, 200);
        assert.equal((tenants.data?.tenants as unknown[]).length, 2);
      });

      await t.test("Seller A cannot read, write, or delete Seller B's tenant", async () => {
        const sellerClient = createClient();
        clients.sellerA = sellerClient;
        const login = await sellerClient.login(
          baseUrl,
          fixtures.sellerA.email,
          TEST_PASSWORD,
        );
        assert.equal(login.response.status, 200);

        const currentUser = await sellerClient.request(baseUrl, "/api/auth/me");
        const authUser = currentUser.data?.user as {
          memberships: Array<{ tenantId: string }>;
        };
        assert.deepEqual(authUser.memberships.map((membership) => membership.tenantId), [
          fixtures.tenantA.id,
        ]);
        const tenantListWithTamperedQuery = await sellerClient.request(
          baseUrl,
          `/api/tenants?tenantId=${fixtures.tenantB.id}&tenant_id=${fixtures.tenantB.id}`,
        );
        assert.equal(tenantListWithTamperedQuery.response.status, 200);
        assert.deepEqual(
          (tenantListWithTamperedQuery.data?.tenants as Array<{ id: string }>).map(
            (tenant) => tenant.id,
          ),
          [fixtures.tenantA.id],
        );
        assert.equal(
          (await sellerClient.request(baseUrl, "/api/tenants/not-a-uuid")).response.status,
          400,
        );

        const tenantList = await sellerClient.request(baseUrl, "/api/tenants");
        assert.equal(tenantList.response.status, 200);
        assert.deepEqual(
          (tenantList.data?.tenants as Array<{ id: string }>).map((tenant) => tenant.id),
          [fixtures.tenantA.id],
        );

        const otherTenant = await sellerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantB.id}`,
        );
        assert.equal(otherTenant.response.status, 404);
        const crossTenantWrite = await sellerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantB.id}`,
          { method: "PATCH", body: { name: "Unauthorized change" } },
        );
        assert.equal(crossTenantWrite.response.status, 404);
        const crossTenantDelete = await sellerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantB.id}`,
          { method: "DELETE" },
        );
        assert.equal(crossTenantDelete.response.status, 403);

        const ownUpdate = await sellerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantA.id}`,
          {
            method: "PATCH",
            body: {
              name: "Integration Tenant A Updated",
              tenantId: fixtures.tenantB.id,
              tenant_id: fixtures.tenantB.id,
              sellerUserId: fixtures.sellerB.id,
              userId: fixtures.sellerB.id,
              accountType: "owner",
            },
          },
        );
        assert.ok(ownUpdate.response.status === 200 || ownUpdate.response.status === 400);
        if (ownUpdate.response.status === 200) {
          assert.equal(ownUpdate.data?.id, fixtures.tenantA.id);
          assert.equal(ownUpdate.data?.sellerUserId, fixtures.sellerA.id);
          assert.equal(ownUpdate.data?.name, "Integration Tenant A Updated");
        }
        const ownerClient = clients.owner;
        assert.ok(ownerClient);
        const tenantBAfterTampering = await ownerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantB.id}`,
        );
        assert.equal(tenantBAfterTampering.response.status, 200);
        assert.equal((tenantBAfterTampering.data as { name: string }).name, "Integration Tenant B");
        assert.equal(
          (tenantBAfterTampering.data as { sellerUserId: string }).sellerUserId,
          fixtures.sellerB.id,
        );
        assert.equal((tenantBAfterTampering.data as { status: string }).status, "active");

        const adminAccess = await sellerClient.request(baseUrl, "/api/admin/users");
        assert.equal(adminAccess.response.status, 403);
      });

      await t.test("Operator is restricted to membership and non-owner actions", async () => {
        const operatorClient = createClient();
        clients.operatorA = operatorClient;
        const login = await operatorClient.login(
          baseUrl,
          fixtures.operatorA.email,
          TEST_PASSWORD,
        );
        assert.equal(login.response.status, 200);

        assert.equal(
          (await operatorClient.request(baseUrl, `/api/tenants/${fixtures.tenantA.id}`))
            .response.status,
          200,
        );
        assert.equal(
          (await operatorClient.request(baseUrl, `/api/tenants/${fixtures.tenantB.id}`))
            .response.status,
          404,
        );
        assert.equal(
          (
            await operatorClient.request(
              baseUrl,
              `/api/tenants/${fixtures.tenantA.id}`,
              { method: "PATCH", body: { name: "Operator change" } },
            )
          ).response.status,
          403,
        );
        assert.equal(
          (
            await operatorClient.request(
              baseUrl,
              `/api/tenants/${fixtures.tenantA.id}`,
              { method: "DELETE" },
            )
          ).response.status,
          403,
        );
        assert.equal(
          (
            await operatorClient.request(baseUrl, "/api/admin/sellers", {
              method: "POST",
              body: {
                email: `not-owner-${suffix}@example.test`,
                displayName: "Should Not Exist",
                password: TEST_PASSWORD,
                tenantName: "Nope",
                tenantSlug: `not-owner-${suffix.slice(0, 8)}`,
              },
            })
          ).response.status,
          403,
        );
        assert.equal(
          (await operatorClient.request(baseUrl, "/api/admin/users")).response.status,
          403,
        );
        assert.equal(
          (
            await operatorClient.request(
              baseUrl,
              `/api/admin/users/${fixtures.sellerB.id}/status`,
              { method: "PATCH", body: { status: "disabled" } },
            )
          ).response.status,
          403,
        );
        assert.equal(
          (
            await operatorClient.request(baseUrl, "/api/admin/operators", {
              method: "POST",
              body: {
                email: `operator-escalation-${suffix}@example.test`,
                displayName: "Should Not Exist",
                password: TEST_PASSWORD,
                tenantId: fixtures.tenantB.id,
              },
            })
          ).response.status,
          403,
        );
      });

      await t.test("Only Owner can provision accounts and disable non-owner users", async () => {
        const ownerClient = clients.owner;
        assert.ok(ownerClient);
        const usersBefore = await ownerClient.request(baseUrl, "/api/admin/users");
        assert.equal(usersBefore.response.status, 200);
        assert.equal((usersBefore.data?.users as unknown[]).length, 3);

        const badInput = await ownerClient.request(baseUrl, "/api/admin/sellers", {
          method: "POST",
          body: {
            email: "invalid",
            displayName: "",
            password: "short",
            tenantName: "",
            tenantSlug: "Bad slug",
          },
        });
        assert.equal(badInput.response.status, 400);

        const sellerCreated = await ownerClient.request(baseUrl, "/api/admin/sellers", {
          method: "POST",
          body: {
            email: `zetas-test-created-seller-${suffix}@example.test`,
            displayName: "Created Seller",
            password: TEST_PASSWORD,
            tenantName: "Created Tenant",
            tenantSlug: `created-${suffix.slice(0, 12)}`,
          },
        });
        assert.equal(sellerCreated.response.status, 201);
        const createdSeller = sellerCreated.data?.user as { id: string };
        const createdTenant = sellerCreated.data?.tenant as { id: string };
        userIds.push(createdSeller.id);
        tenantIds.push(createdTenant.id);
        assert.equal(
          "passwordHash" in (sellerCreated.data?.user as Record<string, unknown>),
          false,
        );

        const operatorCreated = await ownerClient.request(baseUrl, "/api/admin/operators", {
          method: "POST",
          body: {
            email: `zetas-test-created-operator-${suffix}@example.test`,
            displayName: "Created Operator",
            password: TEST_PASSWORD,
            tenantId: fixtures.tenantA.id,
          },
        });
        assert.equal(operatorCreated.response.status, 201);
        const createdOperator = operatorCreated.data?.user as { id: string };
        userIds.push(createdOperator.id);

        const disabled = await ownerClient.request(
          baseUrl,
          `/api/admin/users/${fixtures.sellerA.id}/status`,
          { method: "PATCH", body: { status: "disabled" } },
        );
        assert.equal(disabled.response.status, 200);
        assert.equal(disabled.data?.status, "disabled");

        const oldSession = await clients.sellerA?.request(baseUrl, "/api/auth/me");
        assert.equal(oldSession?.response.status, 401);
        const disabledSessionWrite = await clients.sellerA?.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantA.id}`,
          { method: "PATCH", body: { name: "Disabled write" } },
        );
        assert.equal(disabledSessionWrite?.response.status, 401);
        const disabledLogin = await createClient().login(
          baseUrl,
          fixtures.sellerA.email,
          TEST_PASSWORD,
        );
        assert.equal(disabledLogin.response.status, 401);
        assert.equal(disabledLogin.data?.error, "Email or password is incorrect");

        const reactivated = await ownerClient.request(
          baseUrl,
          `/api/admin/users/${fixtures.sellerA.id}/status`,
          { method: "PATCH", body: { status: "active" } },
        );
        assert.equal(reactivated.response.status, 200);
        assert.equal(reactivated.data?.status, "active");
      });

      await t.test("CSRF protects writes and logout invalidates the session", async () => {
        const sellerClient = createClient();
        clients.sellerB = sellerClient;
        assert.equal(
          (await sellerClient.login(baseUrl, fixtures.sellerB.email, TEST_PASSWORD)).response
            .status,
          200,
        );
        const missingCsrf = await sellerClient.request(
          baseUrl,
          `/api/tenants/${fixtures.tenantB.id}`,
          { method: "PATCH", body: { name: "No CSRF" }, includeCsrf: false },
        );
        assert.equal(missingCsrf.response.status, 403);

        const logout = await sellerClient.request(baseUrl, "/api/auth/logout", {
          method: "POST",
        });
        assert.equal(logout.response.status, 204);
        const afterLogout = await sellerClient.request(baseUrl, "/api/auth/me");
        assert.equal(afterLogout.response.status, 401);
      });

      await t.test("Invalid login input is rejected and attempts are rate-limited", async () => {
        const invalidClient = createClient();
        await invalidClient.prepareCsrf(baseUrl);
        const invalid = await invalidClient.request(baseUrl, "/api/auth/login", {
          method: "POST",
          body: { email: "not-an-email", password: "" },
        });
        assert.equal(invalid.response.status, 400);

        const throttled = createClient();
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          const result = await throttled.login(
            baseUrl,
            `rate-limit-${suffix}@example.test`,
            "wrong-password",
          );
          assert.equal(result.response.status, 401);
        }
        const limited = await throttled.request(baseUrl, "/api/auth/login", {
          method: "POST",
          body: {
            email: `rate-limit-${suffix}@example.test`,
            password: "wrong-password",
          },
        });
        assert.equal(limited.response.status, 429);
      });
    } finally {
      for (const client of allClients) {
        for (const id of client.sessionIds) sessionIds.add(id);
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });

      for (const sessionId of sessionIds) {
        await db.delete(sessionsTable).where(eq(sessionsTable.sid, sessionId));
      }
      if (userIds.length || tenantIds.length) {
        for (const userId of userIds) {
          await db
            .delete(auditLogsTable)
            .where(
              or(
                eq(auditLogsTable.actorUserId, userId),
                eq(auditLogsTable.targetUserId, userId),
              ),
            );
        }
        for (const tenantId of tenantIds) {
          await db
            .delete(auditLogsTable)
            .where(eq(auditLogsTable.tenantId, tenantId));
          await db
            .delete(tenantMembershipsTable)
            .where(eq(tenantMembershipsTable.tenantId, tenantId));
          await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
        }
        for (const userId of userIds) {
          await db.delete(usersTable).where(eq(usersTable.id, userId));
        }
      }
      await pool.end();
    }
  },
);
