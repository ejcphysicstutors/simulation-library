import Link from "next/link";
import { simulations, topics } from "@/lib/data/catalog";

export default function HomePage() {
  return (
    <main>
      <section className="hero hero-simple">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">Eunoia Junior College • Physics</p>
            <h1>Physics you can explore.</h1>
            <p className="hero-copy">
              Interactive simulations organised around the A-Level physics curriculum, built by teachers for purposeful exploration.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/library">Browse simulations</Link>
              <Link className="button secondary" href="/login">Sign in</Link>
            </div>
          </div>
          <div className="hero-card" aria-label="Library overview">
            <div><strong>{simulations.length}</strong><span>simulations</span></div>
            <div><strong>{topics.length}</strong><span>mapped topics</span></div>
            <div><strong>H1 · H2 · H3</strong><span>one physics library</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
