import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminAccess } from "@/lib/auth/session";
import { getInitialAdminEmails } from "@/lib/auth/config";
import { removeAccessUser, upsertAccessUser } from "./actions";

type AccessRow = {
  email: string;
  role: "contributor" | "admin";
  active: boolean;
};

async function listAccessUsers(): Promise<AccessRow[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("access_users").get();
  return snapshot.docs
    .map((doc) => doc.data() as Partial<AccessRow>)
    .filter((row): row is AccessRow => Boolean(row.email && row.active && (row.role === "admin" || row.role === "contributor")))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export default async function AccessManagementPage() {
  const session = await requireAdminAccess();
  const accessUsers = await listAccessUsers();
  const bootstrapAdmins = getInitialAdminEmails();

  return (
    <main className="shell section admin-page">
      <div className="admin-title-row">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Administration</p>
          <h1>Access management</h1>
          <p>Add teachers as contributors or admins. Admin access automatically includes contributor permissions.</p>
        </div>
        <div className="admin-nav-inline"><Link className="button secondary" href="/admin">Dashboard</Link><Link className="button secondary" href="/admin/submissions">Review submissions</Link></div>
      </div>

      <section className="admin-panel">
        <h2>Add or update access</h2>
        <form className="access-form" action={upsertAccessUser}>
          <label>
            <span>Email address</span>
            <input className="text-field" name="email" type="email" placeholder="teacher@example.edu.sg" required />
          </label>
          <label>
            <span>Role</span>
            <select className="text-field" name="role" defaultValue="contributor">
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="button primary" type="submit">Save access</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="panel-heading-row">
          <div>
            <h2>Privileged users</h2>
            <p>Ordinary EJC-domain users are students and do not appear here.</p>
          </div>
          <span className="access-badge">Signed in: {session.email}</span>
        </div>

        <div className="access-table-wrap">
          <table className="access-table">
            <thead><tr><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {bootstrapAdmins.map((email) => (
                <tr key={`bootstrap-${email}`}>
                  <td>{email}</td><td>Admin</td><td>Environment bootstrap</td><td></td>
                </tr>
              ))}
              {accessUsers.map((user) => (
                <tr key={user.email}>
                  <td>{user.email}</td><td>{user.role === "admin" ? "Admin" : "Contributor"}</td><td>Active</td>
                  <td>
                    {user.email !== session.email ? (
                      <form action={removeAccessUser}>
                        <input type="hidden" name="email" value={user.email} />
                        <button className="text-button danger" type="submit">Remove</button>
                      </form>
                    ) : <span className="muted">Current user</span>}
                  </td>
                </tr>
              ))}
              {bootstrapAdmins.length === 0 && accessUsers.length === 0 ? (
                <tr><td colSpan={4} className="empty-table">No privileged users have been added yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
