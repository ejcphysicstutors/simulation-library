import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { simulationMap } from "@/lib/data/catalog";

export default async function SimulationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudentAccess();
  const { slug } = await params;
  const simulation = simulationMap.get(slug);

  if (!simulation) notFound();

  const isPublished = simulation.status === "published" && Boolean(simulation.contentPath);

  return (
    <main className="shell section detail-page">
      <Link className="back-link" href="/library">← Back to library</Link>

      <section className="detail-hero detail-hero-simple">
        <div>
          <h1>{simulation.title}</h1>
          <p className="detail-description">{simulation.description}</p>
          {simulation.author ? <p className="detail-author">Created by {simulation.author}</p> : null}
        </div>
      </section>

      <section className="detail-grid">
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
              <a className="button secondary inline-button" href={simulation.contentPath} target="_blank" rel="noreferrer">
                Open simulation in a new tab ↗
              </a>
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
