import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseReadinessResult } from "../lib/database-readiness";

test("database readiness returns generic ready and unavailable responses", async () => {
  let probeCalled = false;
  const ready = await getDatabaseReadinessResult(async () => {
    probeCalled = true;
    return { rows: [{ value: 1 }] };
  });
  assert.equal(probeCalled, true);
  assert.deepEqual(ready, { statusCode: 200, body: { status: "ready" } });

  const unavailable = await getDatabaseReadinessResult(async () => {
    throw new Error("internal database connection detail");
  });
  assert.deepEqual(unavailable, {
    statusCode: 503,
    body: { status: "not_ready" },
  });
  assert.doesNotMatch(
    JSON.stringify(unavailable),
    /internal database connection detail/,
  );
});
