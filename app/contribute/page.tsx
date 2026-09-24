import Link from "next/link";

import { SubmissionForm } from "@/components/contribute/submission-form";
import { requireContributorAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getLibrarySimulations } from "@/lib/library/managed";
import { listContributorSubmissions } from "@/lib/submissions/data";
import type { SubmissionStatus } from "@/lib/submissions/types";
import { archiveSubmission, restoreSubmission } from "./actions";

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

type Props = {
  searchParams?: Promise<{ archived?: string }>;
};

export default async function ContributePage({ searchParams }: Props) {
  const session = await requireContributorAccess();
  const submissions = await listContributorSubmissions(session.email);
  const simulations = await getLibrarySimulations();
  const params = searchParams ? await searchParams : {};
  const showArchived = params.archived === "1";

  const visibleSubmissions = submissions.filter((submission) => showArchived ? Boolean(submission.archivedAt) : !submission.archivedAt);
  const archivedCount = submissions.filter((submission) => Boolean(submission.archivedAt)).length;

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
        <SubmissionForm topics={topics} simulations={simulations.filter((simulation) => simulation.status === "published")} contributorName={session.name || session.email} />

        <aside className="submission-history">
          <div className="panel-heading-row">
            <div><p className="eyebrow">Your submissions</p><h2>{showArchived ? "Archived activity" : "Recent activity"}</h2></div>
            <span>{visibleSubmissions.length}</span>
          </div>

          <div className="submission-history-tools">
            {showArchived ? (
              <Link href="/contribute">Back to recent</Link>
            ) : archivedCount ? (
              <Link href="/contribute?archived=1">Show archived ({archivedCount})</Link>
            ) : (
              <span>No archived submissions</span>
            )}
          </div>

          {visibleSubmissions.length ? (
            <div className="submission-list">
              {visibleSubmissions.slice(0, 10).map((submission) => (
                <article key={submission.submissionId}>
                  <div><strong>{submission.title}</strong><small>{submission.kind === "update" ? "Update" : "New simulation"} · {submission.originalFilename}</small>{submission.adminNote ? <small className="submission-admin-note">Reviewer: {submission.adminNote}</small> : null}</div>
                  <div className="submission-row-actions">
                    <span className={`submission-status status-${submission.status}`}>{STATUS_LABELS[submission.status]}</span>
                    <form action={showArchived ? restoreSubmission : archiveSubmission}>
                      <input type="hidden" name="submissionId" value={submission.submissionId} />
                      <button type="submit" className="submission-archive-button">{showArchived ? "Restore" : "Archive"}</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="empty-submissions">{showArchived ? "No archived submissions." : "No submissions yet. Your first upload will appear here."}</p>}
        </aside>
      </div>
    </main>
  );
}
