import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { simulationMap, topicMap } from "@/lib/data/catalog";

const migrationLabels = {
  ready: "Ready to migrate",
  "needs-repair": "Repair needed",
  "needs-review": "Review needed",
  rebuild: "Rebuild needed"
} as const;

export default async function SimulationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudentAccess();
  const { slug } = await params;
  const simulation = simulationMap.get(slug);

  if (!simulation) notFound();

  const topic = topicMap.get(simulation.primaryTopicId);
  const relatedTopics = simulation.relatedTopicIds
    .map((id) => topicMap.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className="shell section detail-page">
      <Link className="back-link" href="/library">← Back to library</Link>

      <section className="detail-hero">
        <div>
          <div className="level-row">
            {simulation.levels.map((level) => <span key={level}>{level}</span>)}
          </div>
          <p className="eyebrow detail-eyebrow">{topic?.strand} · {topic?.name}</p>
          <h1>{simulation.title}</h1>
          <p className="detail-description">{simulation.description}</p>
          {simulation.author ? <p className="detail-author">Created by {simulation.author}</p> : null}
        </div>
        <aside className="migration-panel">
          <span className={`migration-chip migration-${simulation.migrationStatus}`}>
            {migrationLabels[simulation.migrationStatus]}
          </span>
          <h2>Migration status</h2>
          <p>{simulation.migrationNote ?? "Migration review has not been completed yet."}</p>
        </aside>
      </section>

      <section className="detail-grid">
        <article className="detail-card simulation-stage-placeholder">
          <p className="eyebrow">Simulation player</p>
          <h2>Player coming during migration</h2>
          <p>
            The new library will run validated simulations from an isolated content origin. Until this item is repaired and migrated, the legacy copy remains separate.
          </p>
          {simulation.legacyUrl ? (
            <a className="button secondary inline-button" href={simulation.legacyUrl} target="_blank" rel="noreferrer">
              View legacy version ↗
            </a>
          ) : null}
        </article>

        <article className="detail-card">
          <p className="eyebrow">Curriculum mapping</p>
          <h2>Where this fits</h2>
          <dl className="metadata-list">
            <div><dt>Primary topic</dt><dd>{topic?.name ?? "Unassigned"}</dd></div>
            <div><dt>Strand</dt><dd>{topic?.strand ?? "—"}</dd></div>
            <div><dt>Levels</dt><dd>{simulation.levels.join(" · ")}</dd></div>
            <div><dt>Syllabus</dt><dd>{topic?.syllabusCode ?? "—"}</dd></div>
          </dl>
          {relatedTopics.length ? (
            <div className="related-topics">
              <strong>Related topics</strong>
              <div className="level-row">{relatedTopics.map((item) => <span key={item.id}>{item.name}</span>)}</div>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
