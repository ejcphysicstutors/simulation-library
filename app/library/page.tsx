import { LibraryBrowser } from "@/components/library/library-browser";
import { requireStudentAccess } from "@/lib/auth/session";
import { simulations, topics } from "@/lib/data/catalog";

export default async function LibraryPage() {
  const session = await requireStudentAccess();

  return (
    <main className="shell section">
      <div className="library-heading syllabus-heading">
        <div>
          <p className="eyebrow">EJC Physics Simulation Library</p>
          <h1>Explore physics interactively.</h1>
          <p>Search or browse by level and topic to find an interactive simulation.</p>
        </div>
        <aside className="catalog-stat" aria-label="Simulation library summary">
          <strong>{simulations.length}</strong>
          <span>simulations</span>
          <small>across H1, H2 and H3 Physics</small>
        </aside>
      </div>

      <LibraryBrowser simulations={simulations} topics={topics} isDemo={session.kind === "demo"} />
    </main>
  );
}
