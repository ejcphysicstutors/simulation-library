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
            Browse the library using the syllabus coverage shown in the official H1/H2/H3 physics framework. Each topic is labelled by the level or levels in which it is covered.
          </p>
        </div>
        <aside className="catalog-stat" aria-label="Migration catalogue summary">
          <strong>{simulations.length}</strong>
          <span>legacy simulations catalogued</span>
          <small>24 canonical topics across H1/H2/H3</small>
        </aside>
      </div>

      <LibraryBrowser simulations={simulations} topics={topics} isDemo={session.kind === "demo"} />
    </main>
  );
}
