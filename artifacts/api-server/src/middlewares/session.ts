import type { RequestHandler } from "express";
import type { Session, SessionData } from "express-session";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";

export const SESSION_COOKIE_NAME = "zetas.sid";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
}

const PgSessionStore = connectPgSimple(session);

export const sessionMiddleware: RequestHandler = session({
  name: SESSION_COOKIE_NAME,
  secret,
  store: new PgSessionStore({
    pool,
    tableName: "sessions",
    createTableIfMissing: false,
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: "auto",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  },
});

export type SessionRequest = {
  session: Session & SessionData;
};
