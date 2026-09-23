import Link from "next/link";

import { requireAdminAccess } from "@/lib/auth/session";
import { listAllSubmissions } from "@/lib/submissions/data";
import type { SubmissionStatus } from "@/lib/submissions/types";

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  validating: "Checking",
  "needs-changes": "Changes needed",
  "awaiting-review": "Awaiting review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};

export default async function AdminSubmissionsPage() {
  await requireAdminAccess();
  const submissions = await listAllSubmissions();
  const awaiting = submissions.filter((item) => item.status === "awaiting-review" || item.status === "needs-changes").length;

  return (
    <main className="shell section admin-page review-admin-page">
      <div className="admin-title-row">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Simulation review</h1>
          <p className="lead-copy">Every upload is checked before it can become part of the published library.</p>
        </div>
        <div className="admin-nav-inline">
          <Link className="button secondary" href="/admin/access">Access management</Link>
        </div>
      </div>

      <section className="review-summary-row">
        <div><strong>{submissions.length}</strong><span>Total submissions</span></div>
        <div><strong>{awaiting}</strong><span>Need attention</span></div>
      </section>

      <section className="admin-panel">
        <div className="panel-heading-row"><div><h2>Review queue</h2><p>Open a submission to inspect its automated checks and preview.</p></div></div>
        {submissions.length ? (
          <div className="review-list">
            {submissions.map((submission) => (
              <Link key={submission.submissionId} href={`/admin/submissions/${submission.submissionId}`} className="review-row">
                <div className="review-row-main">
                  <strong>{submission.title}</strong>
                  <span>{submission.contributorName || submission.contributorEmail}</span>
                  <small>{submission.kind === "update" ? "Update" : "New simulation"} · {submission.originalFilename}</small>
                </div>
                <div className="review-row-metrics">
                  {submission.validation ? (
                    <small>{submission.validation.errors} errors · {submission.validation.warnings} warnings</small>
                  ) : <small>Not checked yet</small>}
                  <span className={`submission-status status-${submission.status}`}>{STATUS_LABELS[submission.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : <p className="empty-submissions">No submissions have been received yet.</p>}
      </section>
    </main>
  );
}
