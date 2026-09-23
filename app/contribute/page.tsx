import { requireContributorAccess } from "@/lib/auth/session";

export default async function ContributePage() {
  const session = await requireContributorAccess();

  return (
    <main className="shell section narrow-page">
      <p className="eyebrow">Contributor portal</p>
      <h1>Welcome, {session.name || session.email}</h1>
      <p className="lead-copy">Your contributor access is active. The upload and versioning workflow will be built on this protected route next.</p>
      <div className="status-card">
        <strong>Access verified</strong>
        <span>{session.role === "admin" ? "Admin + contributor" : "Contributor"}</span>
        <small>{session.email}</small>
      </div>
    </main>
  );
}
