import Link from "next/link";

import { requireAdminAccess } from "@/lib/auth/session";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminDashboardPage() {
  await requireAdminAccess();
  const data = await getAdminDashboardData();

  return (
    <main className="shell section admin-page admin-dashboard-page">
      <div className="admin-title-row">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Dashboard</h1>
          <p className="lead-copy">A quick view of what needs attention, what was published recently, and whether the pipeline is healthy.</p>
        </div>
        <div className="admin-nav-inline">
          <Link className="button primary" href="/admin/submissions">Review submissions</Link>
        </div>
      </div>

      <section className="admin-dashboard-stats" aria-label="Admin summary">
        <Link href="/admin/submissions" className="admin-stat-card emphasis">
          <strong>{data.pendingReview.length}</strong>
          <span>Need review</span>
          <small>{data.validationFailures.length} with validation errors</small>
        </Link>
        <Link href="/admin/simulations" className="admin-stat-card">
          <strong>{data.liveManaged.length}</strong>
          <span>Managed live</span>
          <small>{data.archivedSimulations.length} archived</small>
        </Link>
        <Link href="/admin/access" className="admin-stat-card">
          <strong>{data.contributorCount}</strong>
          <span>Contributors</span>
          <small>{data.adminCount} admins</small>
        </Link>
        <div className="admin-stat-card">
          <strong>{data.cleanupScheduled.length}</strong>
          <span>Staging cleanups</span>
          <small>{data.cleanupDue.length} due now · {data.cleanupCompleted.length} completed</small>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-dashboard-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Needs attention</h2>
              <p>Submissions waiting for review or contributor changes.</p>
            </div>
            <Link className="text-button" href="/admin/submissions">View all</Link>
          </div>
          {data.pendingReview.length ? (
            <div className="dashboard-list">
              {data.pendingReview.slice(0, 6).map((item) => (
                <Link href={`/admin/submissions/${item.submissionId}`} className="dashboard-list-row" key={item.submissionId}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.contributorName || item.contributorEmail}</span>
                  </div>
                  <div className="dashboard-list-meta">
                    <small>{item.validation ? `${item.validation.errors} errors · ${item.validation.warnings} warnings` : "Not checked"}</small>
                    <span className={`submission-status status-${item.status}`}>{item.status === "needs-changes" ? "Changes needed" : "Awaiting review"}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="empty-submissions">Nothing needs attention right now.</p>}
        </section>

        <section className="admin-panel admin-dashboard-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Recent publishes</h2>
              <p>Latest simulations approved through the managed workflow.</p>
            </div>
          </div>
          {data.recentPublishes.length ? (
            <div className="dashboard-list compact">
              {data.recentPublishes.map((item) => (
                <div className="dashboard-list-row" key={item.submissionId}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.kind === "update" ? "Updated simulation" : "New simulation"}</span>
                  </div>
                  <small>{formatDate(item.publishedAt)}</small>
                </div>
              ))}
            </div>
          ) : <p className="empty-submissions">No managed publications yet.</p>}
        </section>

        <section className="admin-panel admin-dashboard-panel">
          <div className="panel-heading-row">
            <div>
              <h2>In-app notifications</h2>
              <p>Updates are shown inside the library, with no external email service required.</p>
            </div>
            <span className="health-pill healthy">Active</span>
          </div>
          <p className="dashboard-note">Contributors see submission, changes-requested and publication updates. Admins see new submissions awaiting review. Unread updates appear in the header.</p>
        </section>

        <section className="admin-panel admin-dashboard-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Housekeeping</h2>
              <p>Submission history is retained while temporary upload files are cleaned separately.</p>
            </div>
          </div>
          <div className="housekeeping-grid">
            <div><strong>{data.archivedSubmissions.length}</strong><span>Archived submissions</span></div>
            <div><strong>{data.cleanupScheduled.length}</strong><span>Files awaiting cleanup</span></div>
            <div><strong>{data.cleanupDue.length}</strong><span>Cleanup overdue</span></div>
          </div>
          {data.cleanupDue.length > 0 ? <p className="dashboard-warning">Some staging files are past their scheduled deletion time. Check the Vercel cron run if this remains after the next daily cleanup.</p> : null}
        </section>
      </div>
    </main>
  );
}
