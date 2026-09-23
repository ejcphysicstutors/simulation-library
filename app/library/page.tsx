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
          <p>
            Browse the migration catalogue using the canonical H2 Physics 9478 topic structure. H1 uses the same shared library through level tags, while the data model is ready for H3 content later.
          </p>
        </div>
        <aside className="catalog-stat" aria-label="Migration catalogue summary">
          <strong>{simulations.length}</strong>
          <span>legacy simulations catalogued</span>
          <small>{topics.length} canonical 9478 topics</small>
        </aside>
      </div>

      <LibraryBrowser simulations={simulations} topics={topics} isDemo={session.kind === "demo"} />
    </main>
  );
}
