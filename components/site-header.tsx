import Link from "next/link";

import { getAccessSession } from "@/lib/auth/session";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const session = await getAccessSession();

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
          {session ? <Link href="/library">Library</Link> : null}
          {session?.kind === "google" && (session.role === "contributor" || session.role === "admin") ? (
            <Link href="/contribute">Contribute</Link>
          ) : null}
          {session?.kind === "google" && session.role === "admin" ? <Link href="/admin/submissions">Admin</Link> : null}
          {session ? (
            <>
              <span className="access-badge">{session.kind === "demo" ? "Demo" : session.role}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
