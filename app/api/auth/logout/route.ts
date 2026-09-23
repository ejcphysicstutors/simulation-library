import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, FIREBASE_SESSION_COOKIE } from "@/lib/auth/config";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(DEMO_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
