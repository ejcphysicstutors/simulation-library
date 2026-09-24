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
        <h1>Access the library</h1>
        <LoginForm />
      </section>
    </main>
  );
}
