export type DatabaseReadinessResult =
  | { statusCode: 200; body: { status: "ready" } }
  | { statusCode: 503; body: { status: "not_ready" } };

export async function getDatabaseReadinessResult(
  probe: () => Promise<unknown>,
): Promise<DatabaseReadinessResult> {
  try {
    await probe();
    return { statusCode: 200, body: { status: "ready" } };
  } catch {
    return { statusCode: 503, body: { status: "not_ready" } };
  }
}
