import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

async function derive(password: string, salt: Buffer, cost = COST): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      {
        N: cost,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY,
      },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived as Buffer);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `$scrypt$N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") return false;

  const parameters = /^N=(16384|32768),r=8,p=1$/.exec(parts[2] ?? "");
  if (!parameters) return false;

  const salt = Buffer.from(parts[3] ?? "", "base64url");
  const expected = Buffer.from(parts[4] ?? "", "base64url");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, salt, Number(parameters[1]));
  return timingSafeEqual(actual, expected);
}

const dummyPasswordHashPromise = hashPassword(randomBytes(32).toString("base64url"));

export async function verifyPasswordOrDummy(
  password: string,
  encoded: string | undefined,
): Promise<boolean> {
  if (!encoded) {
    await dummyPasswordHashPromise;
    const dummyHash = await dummyPasswordHashPromise;
    await verifyPassword(password, dummyHash);
    return false;
  }
  return verifyPassword(password, encoded);
}
