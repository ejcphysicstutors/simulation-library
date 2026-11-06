import Link from "next/link";
import { notFound } from "next/navigation";

import { RevalidationButton } from "@/components/admin/revalidation-button";
import { requireAdminAccess } from "@/lib/auth/session";
import { simulations as staticSimulations, topics } from "@/lib/data/catalog";
import { getManagedSimulation } from "@/lib/library/managed";
import { getPrivateBlobBytes } from "@/lib/submissions/blob";
import { getSubmissionRecord } from "@/lib/submissions/data";
import { approveSubmission, markNeedsChanges, rejectSubmission, saveSubmissionMetadata } from "../actions";

const VALIDATION_HELP: Record<string, { meaning: string; importance: string }> = {
  PACKAGE: { meaning: "Identifies how the uploaded simulation is packaged.", importance: "This tells the reviewer whether the app is a standalone HTML file or a multi-file ZIP project." },
  ZIP_READ: { meaning: "Checks that the ZIP can be opened and its files can be read.", importance: "A damaged or unreadable archive cannot be previewed or published safely." },
  ZIP_SAFETY: { meaning: "Checks the archive for unsafe or malformed ZIP structures.", importance: "This protects the review system from files designed to escape normal extraction limits." },
  ZIP_PATHS: { meaning: "Checks that files stay inside the project folder when extracted.", importance: "Path traversal could overwrite or expose files outside the simulation package." },
  ZIP_SIZE: { meaning: "Checks the expanded size and number of files in the ZIP.", importance: "Very large expanded packages can exhaust storage or memory even when the uploaded ZIP itself is small." },
  ENTRYPOINT: { meaning: "Finds the index.html page that should launch the simulation.", importance: "The library needs one unambiguous entry page in order to preview and publish the simulation." },
  HTML_DOCUMENT: { meaning: "Checks that the main HTML has the expected document structure.", importance: "Incomplete HTML can render unpredictably across browsers and may indicate a truncated AI-generated file." },
  LOCAL_ASSETS: { meaning: "Checks references to local scripts, stylesheets, images and other project files.", importance: "Missing local files often cause a simulation to look correct in source code but fail when opened." },
  EXTERNAL_DEPENDENCIES: { meaning: "Notes scripts, styles or other resources loaded from the internet.", importance: "External services can later change, disappear or be blocked by school networks, so the preview should confirm they work." },
  DUPLICATE_IDS: { meaning: "Looks for repeated HTML element IDs.", importance: "Duplicate IDs can cause JavaScript or accessibility behaviour to target the wrong element." },
  MATH_RENDERING: { meaning: "Checks whether LaTeX-style maths appears to have a compatible renderer such as MathJax or KaTeX.", importance: "Without a renderer, students may see raw commands instead of formatted equations." },
  ENCODING: { meaning: "Looks for common signs of damaged character encoding.", importance: "Encoding damage can corrupt physics symbols such as degree signs, Greek letters and mathematical operators." },
  PACKAGE_CONTENTS: { meaning: "Counts text and code files in a ZIP. INFO is not a failure and does not require a correction by itself.", importance: "Automated source checks cannot execute every code path. The count is a reminder that the reviewer should still use the preview and perform any relevant runtime interactions." },
  VALIDATION_FAILURE: { meaning: "The automated checker itself could not finish normally.", importance: "The result is not trustworthy until the check can run successfully, so approval is blocked." },
};

function validationHelp(code: string, severity: string) {
  return VALIDATION_HELP[code] ?? {
    meaning: severity === "info" ? "This is an informational observation, not a failure." : "This automated check highlights a condition found in the uploaded project.",
    importance: severity === "error" ? "Errors must be resolved before approval." : severity === "warning" ? "Warnings need reviewer judgement but do not automatically block approval." : "Use this alongside the preview when deciding whether the simulation is ready."
  };
}

export default async function SubmissionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAccess();
  const { id } = await params;
  const submission = await getSubmissionRecord(id);
  if (!submission) notFound();

  const topic = topics.find((item) => item.id === submission.primaryTopicId);
  const validation = submission.validation;
  const canApprove = Boolean(validation && validation.errors === 0 && submission.status !== "published");

  let currentOwner = submission.ownerName?.trim() || "";
  if (!currentOwner && submission.kind === "update" && submission.existingSimulationId) {
    const managed = await getManagedSimulation(submission.existingSimulationId);
    const baseline = staticSimulations.find((item) => item.id === submission.existingSimulationId);
    currentOwner = managed?.author?.trim() || baseline?.author?.trim() || "";
  }
  if (!currentOwner) currentOwner = submission.contributorName || submission.contributorEmail;

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

      <section className="admin-panel editorial-panel">
        <div className="panel-heading-row">
          <div>
            <h2>Publication details</h2>
            <p>Edit the canonical metadata here before publishing. These are the details students will see.</p>
          </div>
        </div>
        <form className="editorial-form" action={saveSubmissionMetadata}>
          <input type="hidden" name="submissionId" value={submission.submissionId} />
          <label className="editorial-field editorial-span-2">
            <span>Simulation title</span>
            <input name="title" defaultValue={submission.title} minLength={3} maxLength={120} required />
          </label>
          <label className="editorial-field editorial-span-2">
            <span>Brief description</span>
            <textarea name="description" rows={3} defaultValue={submission.description} minLength={20} maxLength={900} required />
          </label>
          <label className="editorial-field editorial-span-2">
            <span>Owner / original creator</span>
            <input name="ownerName" defaultValue={currentOwner} maxLength={120} required />
            <small>This controls the public creator credit. The uploader remains recorded separately for audit purposes.</small>
          </label>

          <fieldset className="editorial-fieldset">
            <legend>Levels</legend>
            <div className="editorial-levels">
              {(["H1", "H2", "H3"] as const).map((level) => (
                <label key={level}><input type="checkbox" name="levels" value={level} defaultChecked={submission.levels.includes(level)} /> {level}</label>
              ))}
            </div>
          </fieldset>

          <label className="editorial-field">
            <span>Primary topic</span>
            <select name="primaryTopicId" defaultValue={submission.primaryTopicId} required>
              {topics.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.availabilityLabel})</option>)}
            </select>
          </label>

          <fieldset className="editorial-fieldset editorial-span-2 related-topic-editor">
            <legend>Related topics <small>optional, up to 5</small></legend>
            <div className="editorial-topic-grid">
              {topics.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" name="relatedTopicIds" value={item.id} defaultChecked={submission.relatedTopicIds.includes(item.id)} />
                  <span>{item.name} <small>({item.availabilityLabel})</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="editorial-actions editorial-span-2">
            <button className="button primary" type="submit">Save publication details</button>
            <small>Saving does not publish. Review the preview and automated checks before approval.</small>
          </div>
        </form>
      </section>

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
                {validation.checks.map((check) => {
                  const help = validationHelp(check.code, check.severity);
                  return (
                  <article key={check.code} className={`validation-check validation-${check.severity}`}>
                    <div>
                      <div className="validation-check-title"><strong>{check.label}</strong>
                        <details className="validation-help">
                          <summary aria-label={`More information about ${check.label}`}>i</summary>
                          <div className="validation-help-card">
                            <strong>What this means</strong><p>{help.meaning}</p>
                            <strong>Why it matters</strong><p>{help.importance}</p>
                          </div>
                        </details>
                      </div>
                      <span>{check.severity}</span>
                    </div>
                    <p>{check.message}</p>
                    {check.details?.length ? <ul>{check.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
                  </article>
                  );
                })}
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

          {submission.reviewHistory?.length ? (
            <section className="admin-panel review-history-panel">
              <h2>Previous review feedback</h2>
              {submission.reviewHistory.slice().reverse().map((review, index) => (
                <div className="review-history-item" key={`${review.reviewedAt ?? index}-${index}`}>
                  <strong>{review.status === "rejected" ? "Not accepted" : "Changes requested"}</strong>
                  {review.note ? <p>{review.note}</p> : <p>No reviewer note was recorded.</p>}
                  {review.reviewedAt ? <small>{new Date(review.reviewedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}</small> : null}
                </div>
              ))}
            </section>
          ) : null}

          <section className="admin-panel review-decision-panel">
            <h2>Review decision</h2>
            <form className="review-action-form">
              <input type="hidden" name="submissionId" value={submission.submissionId} />
              <label><span>Note to contributor</span><textarea name="adminNote" rows={4} defaultValue={submission.adminNote ?? ""} placeholder="Optional for approval; recommended when changes are needed." /></label>
              {submission.status !== "published" ? (
                <div className="review-action-buttons">
                  <button className="button primary" formAction={approveSubmission} disabled={!canApprove}>Approve & publish</button>
                  <button className="button secondary" formAction={markNeedsChanges}>Needs changes</button>
                  <button className="button danger-button" formAction={rejectSubmission}>Reject</button>
                </div>
              ) : <small className="review-help">This submission is already published. Review decisions are locked.</small>}
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
