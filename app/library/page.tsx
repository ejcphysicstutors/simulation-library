import { requireStudentAccess } from "@/lib/auth/session";
import { simulations, topics } from "@/lib/data/catalog";

export default async function LibraryPage() {
  const session = await requireStudentAccess();
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));

  return (
    <main className="shell section">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Simulation library</p>
          <h1>Explore by topic</h1>
          <p>
            {session.kind === "demo"
              ? "You are viewing the read-only demonstration library."
              : "This starter view uses migration samples. The full legacy collection will be imported only after each simulation passes the readiness audit."}
          </p>
        </div>
        <div className="level-pills" aria-label="Syllabus level filters">
          <button className="pill active">All</button>
          <button className="pill">H1</button>
          <button className="pill">H2</button>
          <button className="pill">H3</button>
        </div>
      </div>

      <div className="simulation-grid">
        {simulations.map((simulation) => {
          const topic = topicMap.get(simulation.primaryTopicId);
          return (
            <article className="simulation-card" key={simulation.id}>
              <div className="card-visual"><span>{topic?.name ?? "Physics"}</span></div>
              <div className="card-body">
                <div className="level-row">{simulation.levels.map((level) => <span key={level}>{level}</span>)}</div>
                <h2>{simulation.title}</h2>
                <p>{simulation.description}</p>
                <div className="topic-label">{topic?.strand} · {topic?.name}</div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
