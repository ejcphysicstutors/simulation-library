import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getLibrarySimulationBySlug } from "@/lib/library/managed";

export const dynamic = "force-dynamic";

export default async function SimulationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudentAccess();
  const { slug } = await params;
  const simulation = await getLibrarySimulationBySlug(slug);

  if (!simulation) notFound();

  const topic = topics.find((item) => item.id === simulation.primaryTopicId);
  const isPublished = simulation.status === "published" && Boolean(simulation.contentPath);

  return (
    <main className="shell detail-page student-detail-page">
      <div className="detail-breadcrumbs student-detail-breadcrumbs">
        <Link href="/library">Topics</Link>
        <span>›</span>
        {topic ? <Link href={`/library/topic/${topic.id}`}>{topic.name}</Link> : null}
      </div>

      <section className="student-detail-header">
        <div className="student-detail-copy">
          <div className="student-detail-meta">
            <div className="level-row detail-level-row">
              {simulation.levels.map((item) => <span key={item}>{item}</span>)}
            </div>
            {simulation.author ? (
              <span className="student-detail-author">
                {simulation.migrationCredit ? `Original simulation by ${simulation.author}` : `Created by ${simulation.author}`}
              </span>
            ) : null}
          </div>

          <h1>{simulation.title}</h1>
          <p className="detail-description student-detail-description">{simulation.description}</p>
          {simulation.author && simulation.migrationCredit ? (
            <p className="detail-credit-note student-detail-credit-note">
              {simulation.migrationCredit === "rebuilt"
                ? "Rebuilt for the new EJC Simulation Library"
                : "Updated for the new EJC Simulation Library"}
            </p>
          ) : null}
        </div>

        {isPublished ? (
          <a className="simulation-new-tab-button" href={simulation.contentPath} target="_blank" rel="noreferrer">
            Open in new tab <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>

      <section className="student-detail-grid">
        <article className={`student-player-card ${isPublished ? "simulation-stage" : "simulation-stage-placeholder"}`}>
          {isPublished ? (
            <div className="simulation-frame-wrap student-simulation-frame-wrap">
              <iframe
                className="simulation-frame"
                src={simulation.contentPath}
                title={simulation.title}
                sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="student-coming-soon">
              <h2>Coming soon</h2>
              <p>This simulation is being prepared for the new library.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
