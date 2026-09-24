import Link from "next/link";

export default function HomePage() {
  return (
    <main className="student-home">
      <section className="student-home-hero">
        <div className="shell student-home-inner">
          <p className="eyebrow">Eunoia Junior College • Physics</p>
          <h1>Explore physics.<br />See what changes.</h1>
          <p className="student-home-copy">
            Interactive simulations for H1, H2 and H3 Physics — built by EJC teachers to help you test ideas, vary conditions and make the physics visible.
          </p>
          <div className="button-row student-home-actions">
            <Link className="button primary" href="/library">Browse simulations</Link>
            <Link className="button secondary" href="/login">Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
