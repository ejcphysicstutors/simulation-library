import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudentAccess } from "@/lib/auth/session";
import { getLibrarySimulationBySlug } from "@/lib/library/managed";

export const dynamic = "force-dynamic";

export default async function SimulationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudentAccess();
  const { slug } = await params;
  const simulation = await getLibrarySimulationBySlug(slug);

  if (!simulation) notFound();

  const isPublished = simulation.status === "published" && Boolean(simulation.contentPath);

  return (
    <main className="shell student-detail-page">
      <Link className="student-back-link" href="/library">← Library</Link>

      <header className="student-detail-heading">
        <h1>{simulation.title}</h1>
        <p className="student-detail-description">{simulation.description}</p>
        {simulation.author ? (
          <div className="student-credit">
            <p>
              {simulation.migrationCredit ? `Original simulation by ${simulation.author}` : `Created by ${simulation.author}`}
            </p>
            {simulation.migrationCredit ? (
              <span>
                {simulation.migrationCredit === "rebuilt"
                  ? "Rebuilt for the new EJC Simulation Library"
                  : "Updated for the new EJC Simulation Library"}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className={`student-player-shell ${isPublished ? "" : "student-player-placeholder"}`}>
        {isPublished ? (
          <>
            <div className="student-player-frame-wrap">
              <iframe
                className="student-player-frame"
                src={simulation.contentPath}
                title={simulation.title}
                sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                referrerPolicy="no-referrer"
              />
            </div>
            {!simulation.managed ? (
              <div className="student-player-actions">
                <a href={simulation.contentPath} target="_blank" rel="noreferrer">Open in a new tab ↗</a>
              </div>
            ) : null}
          </>
        ) : (
          <div className="student-coming-soon">
            <h2>Coming soon</h2>
            <p>This simulation is being prepared for the new library.</p>
          </div>
        )}
      </section>
    </main>
  );
}
