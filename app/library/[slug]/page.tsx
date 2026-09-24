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
    <main className="shell section detail-page student-detail-page">
      <div className="detail-breadcrumbs">
        <Link href="/library">All topics</Link>
        <span>›</span>
        {topic ? <Link href={`/library/topic/${topic.id}`}>{topic.name}</Link> : null}
      </div>

      <section className="detail-hero detail-hero-simple student-detail-hero">
        <div>
          <div className="level-row detail-level-row">
            {simulation.levels.map((item) => <span key={item}>{item}</span>)}
          </div>
          <h1>{simulation.title}</h1>
          <p className="detail-description">{simulation.description}</p>
          {simulation.author ? (
            simulation.migrationCredit ? (
              <div className="detail-credit-block">
                <p className="detail-author">Original simulation by {simulation.author}</p>
                <p className="detail-credit-note">
                  {simulation.migrationCredit === "rebuilt"
                    ? "Rebuilt for the new EJC Simulation Library"
                    : "Updated for the new EJC Simulation Library"}
                </p>
              </div>
            ) : (
              <p className="detail-author">Created by {simulation.author}</p>
            )
          ) : null}
        </div>
      </section>

      <section className="detail-grid student-detail-grid">
        <article className={`detail-card ${isPublished ? "simulation-stage" : "simulation-stage-placeholder"}`}>
          {isPublished ? (
            <>
              <div className="simulation-frame-wrap simulation-frame-wrap-clean">
                <iframe
                  className="simulation-frame"
                  src={simulation.contentPath}
                  title={simulation.title}
                  sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                  referrerPolicy="no-referrer"
                />
              </div>
              {!simulation.managed ? (
                <a className="simulation-new-tab-link" href={simulation.contentPath} target="_blank" rel="noreferrer">
                  Open in a new tab ↗
                </a>
              ) : null}
            </>
          ) : (
            <>
              <h2>Coming soon</h2>
              <p>This simulation is being prepared for the new library.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
