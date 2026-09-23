import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/config";
import { resolveServerRole } from "@/lib/auth/server-access";

export async function POST(request: Request) {
  if (!adminAuth) {
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) return NextResponse.json({ error: "Missing Google sign-in token." }, { status: 400 });

  try {
    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const email = decoded.email?.toLowerCase();

    if (!email || decoded.email_verified === false) {
      return NextResponse.json({ error: "A verified Google email address is required." }, { status: 403 });
    }

    const role = await resolveServerRole(email);
    if (!role) {
      return NextResponse.json(
        { error: "This Google account is not authorised for the EJC Physics Simulation Library." },
        { status: 403 },
      );
    }

    const expiresIn = SESSION_MAX_AGE_SECONDS * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(body.idToken, { expiresIn });
    const response = NextResponse.json({ ok: true, role });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Google sign-in could not be verified." }, { status: 401 });
  }
}
