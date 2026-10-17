import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { auditLogsTable, db, pool, usersTable } from "@workspace/db";
import { hashPassword } from "../modules/auth/password";

function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Owner bootstrap requires an interactive terminal."));
  }

  stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Owner bootstrap cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }
        if (character >= " " && character !== "\u007f" && Array.from(value).length < 129) {
          value += character;
        }
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function run(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Owner bootstrap requires an interactive terminal.");
  }

  const [existingOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.accountType, "owner"))
    .limit(1);
  if (existingOwner) {
    throw new Error("An Owner account already exists; refusing to create another.");
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  let email: string;
  let displayName: string;
  try {
    email = (await prompt.question("Owner email: ")).trim().toLowerCase();
    displayName = (await prompt.question("Owner display name: ")).trim();
  } finally {
    prompt.close();
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (displayName.length < 1 || displayName.length > 120) {
    throw new Error("Display name must contain 1 to 120 characters.");
  }

  const password = await readHidden("Owner password (12-128 characters): ");
  const confirmation = await readHidden("Confirm password: ");
  const passwordLength = Array.from(password).length;
  if (passwordLength < 12 || passwordLength > 128) {
    throw new Error("Password must contain 12 to 128 characters.");
  }
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(usersTable)
      .values({
        email,
        displayName,
        passwordHash,
        accountType: "owner",
        status: "active",
      })
      .returning({ id: usersTable.id });

    await tx.insert(auditLogsTable).values({
      actorUserId: owner.id,
      targetUserId: owner.id,
      action: "account.owner_bootstrapped",
    });
  });

  stdout.write("Owner account created. Sign in at /login.\n");
}

try {
  await run();
} catch (error) {
  const errorName =
    error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name
      : "UnknownError";
  stdout.write(`Owner bootstrap failed (${errorName}). No account was created.\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
