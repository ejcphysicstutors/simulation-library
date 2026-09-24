"use client";

import { FormEvent, useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

function destinationForRole(role: string): string {
  if (role === "admin") return "/admin/access";
  if (role === "contributor") return "/contribute";
  return "/library";
}

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState<"google" | "demo" | null>(null);
  const [demoPassword, setDemoPassword] = useState("");
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    if (!firebaseAuth || !isFirebaseConfigured) {
      setError("Sign-in is not available right now. Please try again later.");
      return;
    }

    setBusy("google");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(firebaseAuth, provider);
      const idToken = await result.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await response.json()) as { role?: string; error?: string };
      if (!response.ok || !data.role) throw new Error(data.error || "Unable to sign in.");

      router.push(destinationForRole(data.role));
      router.refresh();
    } catch (cause) {
      await signOut(firebaseAuth).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy("demo");
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: demoPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to enter demo mode.");
      router.push("/library");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enter demo mode.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className="auth-button google" type="button" onClick={handleGoogle} disabled={busy !== null}>
        {busy === "google" ? "Signing in…" : "Login with ejc.edu.sg email"}
      </button>

      <div className="divider"><span>or</span></div>

      <form onSubmit={handleDemo}>
        <label className="field-label" htmlFor="demo-password">Demo password</label>
        <input
          id="demo-password"
          className="text-field"
          type="password"
          autoComplete="current-password"
          value={demoPassword}
          onChange={(event) => setDemoPassword(event.target.value)}
          placeholder="Enter demo password"
          required
        />
        <button className="auth-button" type="submit" disabled={busy !== null}>
          {busy === "demo" ? "Checking…" : "Enter demo"}
        </button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="auth-note">Demo access is read-only.</p>
    </>
  );
}
