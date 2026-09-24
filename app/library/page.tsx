import { LibraryBrowser } from "@/components/library/library-browser";
import { requireStudentAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import { getLibrarySimulations } from "@/lib/library/managed";

export const dynamic = "force-dynamic";
export default async function LibraryPage() {
  const session = await requireStudentAccess();
  const simulations = await getLibrarySimulations();

  return (
    <main className="shell section topic-library-page">
      <div className="library-heading topic-library-heading">
        <div>
          <p className="eyebrow">EJC Physics Simulation Library</p>
          <h1>Browse by topic.</h1>
          <p>Choose the part of the syllabus you are studying, then explore the simulations available for that topic.</p>
        </div>
      </div>

      <LibraryBrowser simulations={simulations} topics={topics} isDemo={session.kind === "demo"} />
    </main>
  );
}
