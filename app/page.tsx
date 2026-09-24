import Link from "next/link";

export default function HomePage() {
  return (
    <main className="student-home">
      <section className="hero hero-simple student-home-hero">
        <div className="shell student-home-inner">
          <p className="eyebrow">Eunoia Junior College · Physics</p>
          <h1>Physics you can explore.</h1>
          <p className="hero-copy">
            Interactive simulations organised around the A-Level physics syllabus.
          </p>
          <div className="button-row">
            <Link className="button primary" href="/library">Browse simulations</Link>
            <Link className="button secondary" href="/login">Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
