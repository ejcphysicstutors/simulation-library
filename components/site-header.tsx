import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">EJC</span>
          <span>
            <strong>Physics Simulation Library</strong>
            <small>Explore • interact • understand</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link href="/library">Library</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}
