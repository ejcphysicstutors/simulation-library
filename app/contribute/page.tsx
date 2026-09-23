import { SubmissionForm } from "@/components/contribute/submission-form";
import { requireContributorAccess } from "@/lib/auth/session";
import { simulations, topics } from "@/lib/data/catalog";
import { listContributorSubmissions } from "@/lib/submissions/data";
import type { SubmissionStatus } from "@/lib/submissions/types";

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  validating: "Checking",
  "needs-changes": "Changes needed",
  "awaiting-review": "Awaiting review",
  approved: "Approved",
  published: "Published",
  rejected: "Not accepted",
};

export default async function ContributePage() {
  const session = await requireContributorAccess();
  const submissions = await listContributorSubmissions(session.email);

  return (
    <main className="shell section contributor-page">
      <div className="contributor-heading">
        <div>
          <p className="eyebrow">Contributor portal</p>
          <h1>Submit a simulation</h1>
          <p className="lead-copy">Upload HTML or ZIP projects without touching GitHub. New versions stay separate from the live library until they are reviewed and approved.</p>
        </div>
        <div className="contributor-identity"><strong>{session.name || session.email}</strong><span>{session.role === "admin" ? "Admin + contributor" : "Contributor"}</span></div>
      </div>

      <div className="contributor-layout">
        <SubmissionForm topics={topics} simulations={simulations.filter((simulation) => simulation.status === "published")} />

        <aside className="submission-history">
          <div className="panel-heading-row"><div><p className="eyebrow">Your submissions</p><h2>Recent activity</h2></div><span>{submissions.length}</span></div>
          {submissions.length ? (
            <div className="submission-list">
              {submissions.slice(0, 10).map((submission) => (
                <article key={submission.submissionId}>
                  <div><strong>{submission.title}</strong><small>{submission.kind === "update" ? "Update" : "New simulation"} · {submission.originalFilename}</small></div>
                  <span className={`submission-status status-${submission.status}`}>{STATUS_LABELS[submission.status]}</span>
                </article>
              ))}
            </div>
          ) : <p className="empty-submissions">No submissions yet. Your first upload will appear here.</p>}
        </aside>
      </div>
    </main>
  );
}
