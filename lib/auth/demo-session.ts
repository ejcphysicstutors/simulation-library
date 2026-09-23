import { createHmac, timingSafeEqual } from "node:crypto";

import { SESSION_MAX_AGE_SECONDS } from "./config";

function getSecret(): string | null {
  return process.env.DEMO_SESSION_SECRET || process.env.DEMO_ACCESS_PASSWORD || null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createDemoSessionToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({ kind: "demo", exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }),
    "utf8",
  ).toString("base64url");

  return `${payload}.${signature(payload, secret)}`;
}

export function verifyDemoSessionToken(token: string | undefined): boolean {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return false;

  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      kind?: string;
      exp?: number;
    };
    return decoded.kind === "demo" && typeof decoded.exp === "number" && decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function passwordMatches(candidate: string): boolean {
  const expectedPassword = process.env.DEMO_ACCESS_PASSWORD;
  if (!expectedPassword) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expectedPassword);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}
