import Link from "next/link";

import { getAccessSession } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/notifications/in-app";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const session = await getAccessSession();
  const homeHref = session ? "/library" : "/";
  const canReceiveWorkflowUpdates = session?.kind === "google" && (session.role === "contributor" || session.role === "admin");
  const unreadNotifications = canReceiveWorkflowUpdates
    ? await countUnreadNotifications(session.email)
    : 0;

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href={homeHref}>
          <span className="brand-mark">EJC</span>
          <span>
            <strong>Physics Simulation Library</strong>
            <small>Explore · interact · understand</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {session ? <Link href="/library">Library</Link> : null}
          {session?.kind === "google" && (session.role === "contributor" || session.role === "admin") ? (
            <Link href="/contribute">Contribute</Link>
          ) : null}
          {session?.kind === "google" && session.role === "admin" ? <Link href="/admin">Admin</Link> : null}
          {canReceiveWorkflowUpdates ? (
            <Link className="notification-nav-link" href="/notifications">
              Updates
              {unreadNotifications ? <span className="notification-count">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span> : null}
            </Link>
          ) : null}
          {session?.kind === "demo" ? <span className="access-badge">Demo</span> : null}
          {session?.kind === "google" && session.role !== "student" ? <span className="access-badge">{session.role}</span> : null}
          {session ? <SignOutButton /> : <Link href="/login">Sign in</Link>}
        </nav>
      </div>
    </header>
  );
}
