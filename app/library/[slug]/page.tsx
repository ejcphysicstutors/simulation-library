import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { simulationMap, topicMap } from "@/lib/data/catalog";

const migrationLabels = {
  ready: "Ready",
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

  const isPublished = simulation.status === "published" && Boolean(simulation.contentPath);

  return (
    <main className="shell section detail-page">
      <Link className="back-link" href="/library">← Back to library</Link>

      <section className="detail-hero">
        <div>
          <div className="level-row">
            {simulation.levels.map((level) => <span key={level}>{level}</span>)}
          </div>
          <p className="eyebrow detail-eyebrow">{topic?.strand} · {topic?.name} {topic ? `(${topic.availabilityLabel})` : ""}</p>
          <h1>{simulation.title}</h1>
          <p className="detail-description">{simulation.description}</p>
          {simulation.author ? <p className="detail-author">Created by {simulation.author}</p> : null}
        </div>
        <aside className="migration-panel">
          <span className={`migration-chip migration-${simulation.migrationStatus}`}>
            {isPublished ? `Published · v${simulation.publishedVersion ?? 1}` : migrationLabels[simulation.migrationStatus]}
          </span>
          <h2>{isPublished ? "Migration record" : "Migration status"}</h2>
          <p>{simulation.migrationNote ?? "Migration review has not been completed yet."}</p>
        </aside>
      </section>

      <section className="detail-grid">
        <article className={`detail-card ${isPublished ? "simulation-stage" : "simulation-stage-placeholder"}`}>
          <p className="eyebrow">Simulation player</p>
          {isPublished ? (
            <>
              <div className="simulation-frame-wrap">
                <iframe
                  className="simulation-frame"
                  src={simulation.contentPath}
                  title={simulation.title}
                  sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="player-note">
                This migrated copy runs inside a restricted sandbox. It cannot access the library login or admin interface.
              </p>
              <a className="button secondary inline-button" href={simulation.contentPath} target="_blank" rel="noreferrer">
                Open simulation in a new tab ↗
              </a>
            </>
          ) : (
            <>
              <h2>Player coming during migration</h2>
              <p>
                This simulation has not yet passed the migration readiness gate. The legacy copy remains separate until it has been repaired and reviewed.
              </p>
              {simulation.legacyUrl ? (
                <a className="button secondary inline-button" href={simulation.legacyUrl} target="_blank" rel="noreferrer">
                  View legacy version ↗
                </a>
              ) : null}
            </>
          )}
        </article>

        <article className="detail-card">
          <p className="eyebrow">Curriculum mapping</p>
          <h2>Where this fits</h2>
          <dl className="metadata-list">
            <div><dt>Primary topic</dt><dd>{topic ? `${topic.name} (${topic.availabilityLabel})` : "Unassigned"}</dd></div>
            <div><dt>Strand</dt><dd>{topic?.strand ?? "—"}</dd></div>
            <div><dt>Levels</dt><dd>{simulation.levels.join(" · ")}</dd></div>
            <div><dt>Syllabus</dt><dd>{topic?.syllabusCode ?? "—"}</dd></div>
            {isPublished ? <div><dt>Library version</dt><dd>v{simulation.publishedVersion ?? 1}</dd></div> : null}
          </dl>
          {topic?.coverageNote ? <p className="coverage-note">{topic.coverageNote}</p> : null}
          {relatedTopics.length ? (
            <div className="related-topics">
              <strong>Related topics</strong>
              <div className="level-row">{relatedTopics.map((item) => <span key={item.id}>{item.name} ({item.availabilityLabel})</span>)}</div>
            </div>
          ) : null}
          {isPublished && simulation.legacyUrl ? (
            <div className="legacy-link-row">
              <a href={simulation.legacyUrl} target="_blank" rel="noreferrer">Compare legacy version ↗</a>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
