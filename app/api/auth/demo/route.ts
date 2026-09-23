import { NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/config";
import { createDemoSessionToken, passwordMatches } from "@/lib/auth/demo-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !passwordMatches(body.password)) {
    return NextResponse.json({ error: "Incorrect demo password." }, { status: 401 });
  }

  const token = createDemoSessionToken();
  if (!token) return NextResponse.json({ error: "Demo access is not configured." }, { status: 503 });

  const response = NextResponse.json({ ok: true, role: "student" });
  response.cookies.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
