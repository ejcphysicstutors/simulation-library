import Link from "next/link";
import { simulations, topics } from "@/lib/data/catalog";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">Eunoia Junior College • Physics</p>
            <h1>Physics you can explore.</h1>
            <p className="hero-copy">
              Interactive simulations organised around the A-Level physics curriculum, built by teachers for purposeful exploration.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/library">Browse simulations</Link>
              <Link className="button secondary" href="/login">Teacher sign in</Link>
            </div>
          </div>
          <div className="hero-card" aria-label="Library overview">
            <div><strong>{simulations.length}</strong><span>starter simulations</span></div>
            <div><strong>{topics.length}</strong><span>mapped topics</span></div>
            <div><strong>H1 · H2 · H3</strong><span>one future-ready library</span></div>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-heading">
          <p className="eyebrow">Designed around the syllabus</p>
          <h2>Start from the physics, not the file structure.</h2>
          <p>Students browse by level and topic. Teachers can later contribute or update simulations through a separate, guided workflow.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card"><span>01</span><h3>Curriculum-led</h3><p>Canonical syllabus topics keep the library coherent as it grows.</p></article>
          <article className="feature-card"><span>02</span><h3>Safe updates</h3><p>New versions will be validated and previewed before replacing anything published.</p></article>
          <article className="feature-card"><span>03</span><h3>Built for teachers</h3><p>No GitHub knowledge required for contributors; technical complexity stays behind the interface.</p></article>
        </div>
      </section>
    </main>
  );
}
