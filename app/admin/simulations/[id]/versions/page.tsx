import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminAccess } from "@/lib/auth/session";
import { simulations as staticSimulations } from "@/lib/data/catalog";
import { getManagedSimulation, listManagedVersions } from "@/lib/library/managed";
import { rollbackLegacy, rollbackVersion } from "./actions";

export default async function VersionHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAccess();
  const { id } = await params;
  const simulation = await getManagedSimulation(id);
  if (!simulation) notFound();
  const versions = await listManagedVersions(id);
  const legacy = staticSimulations.find((item) => item.id === id && item.status === "published");

  return (
    <main className="shell section admin-page">
      <Link className="back-link" href="/admin/submissions">← Simulation review</Link>
      <div className="admin-title-row">
        <div><p className="eyebrow">Version history</p><h1>{simulation.title}</h1><p className="lead-copy">Published versions are immutable. Rollback only changes which version is live.</p></div>
        <span className="access-badge">Current v{simulation.currentVersionNumber}</span>
      </div>
      <section className="admin-panel version-history-list">
        {versions.map((version) => {
          const current = version.id === simulation.currentVersionId;
          return (
            <article className="version-history-row" key={version.id}>
              <div><strong>Version {version.versionNumber}</strong><span>{current ? "Currently live" : "Published"}</span><small>{new Date(version.publishedAt).toLocaleString()} · {version.publishedBy}</small>{version.note ? <p>{version.note}</p> : null}</div>
              {!current ? <form action={rollbackVersion}><input type="hidden" name="simulationId" value={simulation.id} /><input type="hidden" name="versionId" value={version.id} /><button className="button secondary" type="submit">Make live</button></form> : <span className="submission-status status-published">Live</span>}
            </article>
          );
        })}
        {legacy ? (
          <article className="version-history-row">
            <div><strong>Version {legacy.publishedVersion ?? 1}</strong><span>Legacy migration baseline</span><small>Original known-good migrated copy</small></div>
            {simulation.currentVersionId === "legacy-v1" ? <span className="submission-status status-published">Live</span> : <form action={rollbackLegacy}><input type="hidden" name="simulationId" value={simulation.id} /><button className="button secondary" type="submit">Make live</button></form>}
          </article>
        ) : null}
      </section>
    </main>
  );
}
