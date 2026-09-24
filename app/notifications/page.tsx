import Link from "next/link";
import { redirect } from "next/navigation";

import { getAccessSession } from "@/lib/auth/session";
import { listNotificationsForUser } from "@/lib/notifications/in-app";
import { markAllRead, markOneRead } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
}

export default async function NotificationsPage() {
  const session = await getAccessSession();
  if (!session) redirect("/login");
  if (session.kind !== "google" || (session.role !== "contributor" && session.role !== "admin")) redirect("/library");

  const notifications = await listNotificationsForUser(session.email, 50);
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <main className="shell section notifications-page">
      <div className="notifications-heading">
        <div>
          <p className="eyebrow">Updates</p>
          <h1>Notifications</h1>
          <p className="lead-copy">Submission and review updates from the simulation library.</p>
        </div>
        {unread ? (
          <form action={markAllRead}>
            <button className="button secondary" type="submit">Mark all read</button>
          </form>
        ) : null}
      </div>

      {notifications.length ? (
        <div className="notification-list">
          {notifications.map((item) => (
            <article className={`notification-card ${item.readAt ? "is-read" : "is-unread"}`} key={item.notificationId}>
              <div className="notification-card-copy">
                <div className="notification-title-row">
                  {!item.readAt ? <span className="notification-dot" aria-label="Unread" /> : null}
                  <strong>{item.title}</strong>
                </div>
                <p>{item.message}</p>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              <div className="notification-actions">
                <Link className="text-button" href={item.href}>Open</Link>
                {!item.readAt ? (
                  <form action={markOneRead}>
                    <input type="hidden" name="notificationId" value={item.notificationId} />
                    <button className="notification-read-button" type="submit">Mark read</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-notifications">
          <h2>No notifications yet</h2>
          <p>Updates about your submissions or reviews will appear here.</p>
        </div>
      )}
    </main>
  );
}
