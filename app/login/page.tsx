import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getAccessSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const session = await getAccessSession();
  if (session) {
    if (session.kind === "google" && session.role === "admin") redirect("/admin/access");
    if (session.kind === "google" && session.role === "contributor") redirect("/contribute");
    redirect("/library");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Access the library</p>
        <h1>Welcome to EJC Physics</h1>
        <p>EJC users sign in with Google. External visitors can use read-only demo access.</p>
        <LoginForm />
      </section>
    </main>
  );
}
