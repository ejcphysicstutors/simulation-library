import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getSubmissionRecord } from "@/lib/submissions/data";
import { approveSubmission, markNeedsChanges, rejectSubmission } from "../actions";
import { RevalidationButton } from "@/components/admin/revalidation-button";
import { getPrivateBlobBytes } from "@/lib/submissions/blob";

export default async function SubmissionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAccess();
  const { id } = await params;
  const submission = await getSubmissionRecord(id);
  if (!submission) notFound();

  const topic = topics.find((item) => item.id === submission.primaryTopicId);
  const validation = submission.validation;
  const canApprove = Boolean(validation && validation.errors === 0 && submission.status !== "published");

  let previewHtml = "";
  if (submission.packageType === "html" && submission.blobPathname) {
    try {
      const bytes = await getPrivateBlobBytes(submission.blobPathname);
      const originalHtml = new TextDecoder("utf-8").decode(bytes);
      const previewCsp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; connect-src https:; media-src blob: data: https:; worker-src blob:; frame-src https:; base-uri 'none'; form-action 'none'">`;
      previewHtml = /<head[^>]*>/i.test(originalHtml)
        ? originalHtml.replace(/<head([^>]*)>/i, `<head$1>${previewCsp}`)
        : `${previewCsp}${originalHtml}`;
    } catch {
      previewHtml = "";
    }
  }

  return (
    <main className="shell section admin-page review-detail-page">
      <Link className="back-link" href="/admin/submissions">← Review queue</Link>
      <div className="review-detail-heading">
        <div>
          <p className="eyebrow">{submission.kind === "update" ? "Update submission" : "New simulation"}</p>
          <h1>{submission.title}</h1>
          <p>{submission.description}</p>
        </div>
        <span className={`submission-status large status-${submission.status}`}>{submission.status.replaceAll("-", " ")}</span>
      </div>

      <div className="review-detail-grid">
        <section className="admin-panel review-main-panel">
          <div className="panel-heading-row"><div><h2>Automated checks</h2><p>Source-level checks run immediately after upload.</p></div>
            {submission.status !== "published" ? <RevalidationButton submissionId={submission.submissionId} /> : null}
          </div>

          {validation ? (
            <>
              <div className="validation-summary">
                <span className={validation.errors ? "bad" : "good"}>{validation.errors} errors</span>
                <span className={validation.warnings ? "warn" : "good"}>{validation.warnings} warnings</span>
                <span>{validation.passes} passed</span>
              </div>
              <div className="validation-list">
                {validation.checks.map((check) => (
                  <article key={check.code} className={`validation-check validation-${check.severity}`}>
                    <div><strong>{check.label}</strong><span>{check.severity}</span></div>
                    <p>{check.message}</p>
                    {check.details?.length ? <ul>{check.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
                  </article>
                ))}
              </div>
            </>
          ) : <p className="empty-submissions">This submission has not been checked yet.</p>}
        </section>

        <aside className="review-side-column">
          <section className="admin-panel submission-facts">
            <h2>Submission</h2>
            <dl>
              <div><dt>Contributor</dt><dd>{submission.contributorName || submission.contributorEmail}</dd></div>
              <div><dt>File</dt><dd>{submission.originalFilename}</dd></div>
              <div><dt>Package</dt><dd>{submission.packageType.toUpperCase()}</dd></div>
              <div><dt>Levels</dt><dd>{submission.levels.join(" · ")}</dd></div>
              <div><dt>Primary topic</dt><dd>{topic?.name ?? submission.primaryTopicId}</dd></div>
              {validation?.entrypoint ? <div><dt>Entry page</dt><dd>{validation.entrypoint}</dd></div> : null}
            </dl>
          </section>

          <section className="admin-panel review-decision-panel">
            <h2>Review decision</h2>
            <form className="review-action-form">
              <input type="hidden" name="submissionId" value={submission.submissionId} />
              <label><span>Note to contributor</span><textarea name="adminNote" rows={4} defaultValue={submission.adminNote ?? ""} placeholder="Optional for approval; recommended when changes are needed." /></label>
              <div className="review-action-buttons">
                <button className="button primary" formAction={approveSubmission} disabled={!canApprove}>Approve & publish</button>
                <button className="button secondary" formAction={markNeedsChanges}>Needs changes</button>
                <button className="button danger-button" formAction={rejectSubmission}>Reject</button>
              </div>
              {!canApprove && submission.status !== "published" ? <small className="review-help">Resolve validation errors before approval.</small> : null}
              {submission.publishedSimulationId ? <Link className="button secondary" href={`/admin/simulations/${submission.publishedSimulationId}/versions`}>Version history</Link> : null}
            </form>
          </section>
        </aside>
      </div>

      <section className="admin-panel preview-panel">
        <div className="panel-heading-row"><div><h2>Preview</h2><p>Runs in a restricted iframe and cannot access the admin application.</p></div></div>
        {submission.status === "published" && submission.publishedSimulationId ? (
          <div className="admin-preview-frame-wrap"><iframe className="admin-preview-frame" title={`Live ${submission.title}`} sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock" referrerPolicy="no-referrer" src={`/api/library/simulations/${submission.publishedSimulationId}/current/index.html`} /></div>
        ) : submission.packageType === "html" ? (
          previewHtml ? (
            <div className="admin-preview-frame-wrap"><iframe className="admin-preview-frame" title={`Preview of ${submission.title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewHtml} /></div>
          ) : (
            <p className="empty-submissions">The preview could not be loaded from private storage. Run the checks again; if this persists, the review page will show a validation error.</p>
          )
        ) : validation?.entrypoint && validation.errors === 0 ? (
          <div className="admin-preview-frame-wrap"><iframe className="admin-preview-frame" title={`Preview of ${submission.title}`} sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock" referrerPolicy="no-referrer" src={`/api/admin/submissions/${submission.submissionId}/preview/index.html`} /></div>
        ) : (
          <p className="empty-submissions">Run the automated checks successfully before previewing this ZIP project.</p>
        )}
      </section>
    </main>
  );
}
