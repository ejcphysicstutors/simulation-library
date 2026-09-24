import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { requireAdminAccess } from "@/lib/auth/session";
import { simulations as staticSimulations } from "@/lib/data/catalog";
import { listAllManagedSimulations } from "@/lib/library/managed";
import { archiveSimulation, deleteSimulation, restoreSimulation, updateSimulationOwner } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSimulationsPage() {
  await requireAdminAccess();
  const simulations = await listAllManagedSimulations();
  const staticIds = new Set(staticSimulations.map((item) => item.id));

  return (
    <main className="shell section admin-page">
      <Link className="back-link" href="/admin">← Administration</Link>
      <div className="admin-title-row">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Published simulations</h1>
          <p className="lead-copy">Archive hides a simulation from students. Permanent deletion also removes all managed version files.</p>
        </div>
        <div className="admin-nav-inline">
          <Link className="button secondary" href="/admin">Dashboard</Link>
          <Link className="button secondary" href="/admin/submissions">Review queue</Link>
        </div>
      </div>

      <section className="review-summary-row">
        <div><strong>{simulations.filter((item) => item.status === "published").length}</strong><span>Managed live</span></div>
        <div><strong>{simulations.filter((item) => item.status === "archived").length}</strong><span>Archived</span></div>
      </section>

      <section className="admin-panel managed-simulation-list">
        <div className="panel-heading-row"><div><h2>Managed catalogue</h2><p>Only simulations published through the new workflow appear here.</p></div></div>
        {simulations.length ? simulations.map((simulation) => {
          const hasLegacyBaseline = staticIds.has(simulation.id);
          return (
            <article className="managed-simulation-row" key={simulation.id}>
              <div className="managed-simulation-main">
                <div className="managed-simulation-title-row">
                  <strong>{simulation.title}</strong>
                  <span className={`submission-status status-${simulation.status}`}>{simulation.status}</span>
                </div>
                <small>v{simulation.currentVersionNumber} · {hasLegacyBaseline ? "legacy simulation with managed updates" : "new managed simulation"}</small>
                <span>{simulation.description}</span>
                <form className="owner-edit-form" action={updateSimulationOwner}>
                  <input type="hidden" name="simulationId" value={simulation.id} />
                  <label htmlFor={`owner-${simulation.id}`}>Owner / original creator</label>
                  <div className="owner-edit-row">
                    <input
                      id={`owner-${simulation.id}`}
                      name="ownerName"
                      type="text"
                      defaultValue={simulation.author ?? ""}
                      maxLength={160}
                      required
                    />
                    <button className="button secondary" type="submit">Save owner</button>
                  </div>
                </form>
              </div>
              <div className="managed-simulation-actions">
                <Link className="button secondary" href={`/admin/simulations/${simulation.id}/versions`}>Version history</Link>
                {simulation.status === "published" ? (
                  <form action={archiveSimulation}>
                    <input type="hidden" name="simulationId" value={simulation.id} />
                    <button className="button secondary" type="submit">Archive</button>
                  </form>
                ) : (
                  <form action={restoreSimulation}>
                    <input type="hidden" name="simulationId" value={simulation.id} />
                    <button className="button secondary" type="submit">Restore</button>
                  </form>
                )}
                <form action={deleteSimulation}>
                  <input type="hidden" name="simulationId" value={simulation.id} />
                  <ConfirmSubmitButton
                    className="button danger-button"
                    message={hasLegacyBaseline
                      ? "Delete all managed versions of this simulation? The original migrated legacy baseline will remain available in the student library."
                      : "Permanently delete this simulation and every managed version file? This cannot be undone."}
                  >
                    Delete permanently
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          );
        }) : <p className="empty-submissions">No simulations have been published through the new workflow yet.</p>}
      </section>
    </main>
  );
}
