/** Shared server-side identity and tenant-role contracts. */
export type WorkspaceRole = "owner" | "seller" | "operator";

export interface AuthenticatedActor {
  id: string;
  email: string;
  displayName: string;
  accountType: "owner" | "member";
  status: "active" | "disabled";
}

export interface TenantActor {
  tenantId: string;
  role: Exclude<WorkspaceRole, "owner">;
}
