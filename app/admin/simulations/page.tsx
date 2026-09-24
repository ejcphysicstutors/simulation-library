import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { requireAdminAccess } from "@/lib/auth/session";
import { simulations as staticSimulations } from "@/lib/data/catalog";
import { listAllManagedSimulations } from "@/lib/library/managed";
import { archiveSimulation, deleteSimulation, restoreSimulation, updateSimulationOwner } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSimulationsPage() {
  await requireAdminAccess();
  const managed = await listAllManagedSimulations();
  const managedById = new Map(managed.map((item) => [item.id, item]));
  const staticIds = new Set(staticSimulations.map((item) => item.id));

  const legacyRows = staticSimulations.map((legacy) => ({
    legacy,
    managed: managedById.get(legacy.id),
  }));
  const newManaged = managed.filter((item) => !staticIds.has(item.id));

  const legacyArchived = legacyRows.filter((row) => row.managed?.status === "archived").length;
  const legacyVisible = legacyRows.length - legacyArchived;
  const managedLive = newManaged.filter((item) => item.status === "published").length;
  const managedArchived = newManaged.filter((item) => item.status === "archived").length;

  return (
    <main className="shell section admin-page">
      <Link className="back-link" href="/admin">← Administration</Link>
      <div className="admin-title-row">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Simulation catalogue</h1>
          <p className="lead-copy">Archive hides a simulation from students but keeps it available to restore later. Legacy source files are left untouched.</p>
        </div>
        <div className="admin-nav-inline">
          <Link className="button secondary" href="/admin">Dashboard</Link>
          <Link className="button secondary" href="/admin/submissions">Review queue</Link>
        </div>
      </div>

      <section className="review-summary-row">
        <div><strong>{legacyVisible}</strong><span>Legacy visible</span></div>
        <div><strong>{legacyArchived}</strong><span>Legacy archived</span></div>
        <div><strong>{managedLive}</strong><span>New managed live</span></div>
        <div><strong>{managedArchived}</strong><span>New managed archived</span></div>
      </section>

      <section className="admin-panel managed-simulation-list">
        <div className="panel-heading-row">
          <div>
            <h2>Legacy catalogue</h2>
            <p>These are the migrated simulations bundled with the original library. Archiving removes them from topic counts, search and student browsing without deleting the files.</p>
          </div>
        </div>
        {legacyRows.map(({ legacy, managed: record }) => {
          const status = record?.status ?? "published";
          const hasManagedUpdate = Boolean(record && record.currentVersionId !== "legacy-v1");
          const displayed = hasManagedUpdate ? record! : legacy;
          return (
            <article className="managed-simulation-row" key={legacy.id}>
              <div className="managed-simulation-main">
                <div className="managed-simulation-title-row">
                  <strong>{displayed.title}</strong>
                  <span className={`submission-status status-${status}`}>{status}</span>
                </div>
                <small>{hasManagedUpdate ? `Legacy baseline + managed v${record!.currentVersionNumber}` : "Legacy migration baseline"}</small>
                <span>{displayed.description}</span>
                <small>Original creator: {displayed.author ?? "Not recorded"}</small>
              </div>
              <div className="managed-simulation-actions">
                {hasManagedUpdate ? (
                  <Link className="button secondary" href={`/admin/simulations/${legacy.id}/versions`}>Version history</Link>
                ) : null}
                {status === "published" ? (
                  <form action={archiveSimulation}>
                    <input type="hidden" name="simulationId" value={legacy.id} />
                    <ConfirmSubmitButton
                      className="button secondary"
                      message={`Archive ${displayed.title}? It will disappear from the student library but can be restored here later.`}
                    >
                      Archive
                    </ConfirmSubmitButton>
                  </form>
                ) : (
                  <form action={restoreSimulation}>
                    <input type="hidden" name="simulationId" value={legacy.id} />
                    <button className="button secondary" type="submit">Restore</button>
                  </form>
                )}
                {hasManagedUpdate ? (
                  <form action={deleteSimulation}>
                    <input type="hidden" name="simulationId" value={legacy.id} />
                    <ConfirmSubmitButton
                      className="button danger-button"
                      message="Delete all managed versions of this simulation? The legacy baseline will remain in the catalogue unless you archive it afterwards."
                    >
                      Delete managed versions
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-panel managed-simulation-list">
        <div className="panel-heading-row">
          <div>
            <h2>New managed simulations</h2>
            <p>Simulations created entirely through the new submission and publishing workflow.</p>
          </div>
        </div>
        {newManaged.length ? newManaged.map((simulation) => (
          <article className="managed-simulation-row" key={simulation.id}>
            <div className="managed-simulation-main">
              <div className="managed-simulation-title-row">
                <strong>{simulation.title}</strong>
                <span className={`submission-status status-${simulation.status}`}>{simulation.status}</span>
              </div>
              <small>v{simulation.currentVersionNumber} · new managed simulation</small>
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
                  message="Permanently delete this simulation and every managed version file? This cannot be undone."
                >
                  Delete permanently
                </ConfirmSubmitButton>
              </form>
            </div>
          </article>
        )) : <p className="empty-submissions">No new simulations have been published through the new workflow yet.</p>}
      </section>
    </main>
  );
}
