/**
 * Extension points for a future managed authentication integration.
 * This stage deliberately has no local credential or session implementation.
 */
export type WorkspaceRole = "owner" | "seller" | "operator";

export interface AuthenticatedActor {
  userId: string;
  role: WorkspaceRole;
  sellerId?: string;
}

export interface AuthenticationProvider<Request = unknown> {
  authenticate(request: Request): Promise<AuthenticatedActor | null>;
}
