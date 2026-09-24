import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getLibrarySimulations } from "@/lib/library/managed";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  await requireStudentAccess();
  const { topicId } = await params;
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) notFound();

  const allSimulations = await getLibrarySimulations();
  const simulations = allSimulations.filter((simulation) => simulation.primaryTopicId === topic.id);

  return (
    <main className="shell section topic-page">
      <Link className="back-link" href="/library">← Back to all topics</Link>

      <header className="topic-page-heading">
        <div>
          <p className="eyebrow">{topic.strand}</p>
          <h1>{topic.name}</h1>
          <p>{topic.availabilityLabel} · {simulations.length} {simulations.length === 1 ? "simulation" : "simulations"}</p>
          {topic.coverageNote ? <small>{topic.coverageNote}</small> : null}
        </div>
      </header>

      {simulations.length === 0 ? (
        <section className="empty-state">
          <h2>No simulations here yet.</h2>
          <p>This topic is part of the syllabus map but does not yet have a published simulation.</p>
        </section>
      ) : (
        <div className="topic-simulation-list">
          {simulations.map((simulation) => (
            <article className="topic-simulation-row" key={simulation.id}>
              <Link className="simulation-preview-link" href={`/library/${simulation.slug}`} aria-label={`Open ${simulation.title}`}>
                <div className="simulation-mini-preview" aria-hidden="true">
                  {simulation.contentPath ? (
                    <iframe
                      src={simulation.contentPath}
                      title=""
                      tabIndex={-1}
                      sandbox="allow-scripts"
                      loading="lazy"
                    />
                  ) : (
                    <span>Physics simulation</span>
                  )}
                </div>
              </Link>

              <div className="topic-simulation-copy">
                <div className="simulation-row-meta">
                  <div className="level-row">
                    {simulation.levels.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  {simulation.author ? <span className="simulation-byline">By {simulation.author}</span> : null}
                </div>
                <h2><Link href={`/library/${simulation.slug}`}>{simulation.title}</Link></h2>
                <p className="simulation-row-description">{simulation.description}</p>
                <Link className="simulation-open-link" href={`/library/${simulation.slug}`}>Open simulation <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
