import { LibraryBrowser } from "@/components/library/library-browser";
import { requireStudentAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getLibrarySimulations } from "@/lib/library/managed";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await requireStudentAccess();
  const simulations = await getLibrarySimulations();

  return (
    <main className="shell student-library-page">
      <header className="student-library-heading">
        <div>
          <p className="eyebrow">Simulation library</p>
          <h1>What would you like to explore?</h1>
          <p>
            Search by idea, then narrow the library by syllabus level or topic.
          </p>
        </div>
        <p className="library-count"><strong>{simulations.length}</strong> simulations</p>
      </header>

      <LibraryBrowser simulations={simulations} topics={topics} isDemo={session.kind === "demo"} />
    </main>
  );
}
