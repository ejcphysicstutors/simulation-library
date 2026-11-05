# EJC Physics Simulation Library

New-generation simulation library for EJC Physics.

## Architecture decisions

- Next.js application deployed on Vercel.
- Firebase Authentication for Google sign-in.
- Cloud Firestore for roles, taxonomy, simulation metadata, submissions, versions and validation results.
- Private Vercel Blob storage for incoming contributor packages and published managed-simulation files.
- Contributor-uploaded code is sandboxed when served from the main application origin. A separate simulation-serving origin remains the preferred longer-term defence-in-depth design.
- Approved EJC Google-account domains receive student access automatically.
- Contributor/admin access is explicitly allowlisted in Firestore.
- `INITIAL_ADMIN_EMAILS` provides a server-side bootstrap admin list so the first admin never needs to be hard-coded in GitHub. Bootstrap admins must be removed from that environment variable; the Access page cannot revoke them by itself.
- External demo access is read-only and protected by a server-side shared password with a short-lived signed session cookie. Use a long, unique demo password.
- Firestore is wrapped behind a data-access layer so a future SQL migration remains possible.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Firebase web app configuration values.
3. Create a Firebase service account and add the Admin SDK values to `.env.local` / Vercel environment variables.
4. Set `NEXT_PUBLIC_STUDENT_EMAIL_DOMAINS` or `ALLOWED_EJC_DOMAINS` to the Google-account domain(s) that receive student access.
5. Put your own email in `INITIAL_ADMIN_EMAILS` for the first deployment.
6. Set a long `DEMO_ACCESS_PASSWORD` (and optionally `DEMO_SESSION_SECRET`).
7. In Firebase Authentication, enable the **Google** sign-in provider and add your deployed Vercel domain to authorised domains.
8. Connect a private Vercel Blob store to the project.
9. Run `npm install`, then `npm run dev`.

## Access model

- **Student**: any Google account on an approved EJC domain.
- **Contributor**: explicit Firestore access record; can access `/contribute`.
- **Admin**: explicit Firestore access record or bootstrap email; includes contributor access and can manage access at `/admin/access`.
- **Demo**: shared-password, read-only student view only.

Privileged Firestore records live at:

`access_users/{normalised-email}`

with fields `email`, `role`, `active`, timestamps and the admin who made the change.

The starter catalogue remains intentionally small while legacy simulations are audited and repaired.

## Contributor upload storage

Contributor simulation packages are stored temporarily in a **private Vercel Blob store** under `submissions/<submission-id>/...`.

Before testing uploads in Vercel:

1. Open the project's **Storage** tab.
2. Create or connect a **Vercel Blob** store with **Private** access.
3. Connect it to this Vercel project. New stores use Vercel OIDC authentication automatically.
4. Redeploy after the storage connection is active.

Accepted simulation packages: standalone `.html`/`.htm` files or `.zip` projects, maximum 10 MB.

The uploaded package is staging data. Once the publish workflow has copied and verified the approved version, the staging blob can be deleted without affecting the published simulation.

## Notifications

Workflow notifications are in-app. Contributors can see submission/review/publish updates in the application, and admins receive in-app review-pipeline notifications. Notification failures are logged and do not block uploads, review actions or publishing.

## Simulation-file access and sandboxing

The library pages require an authenticated library session, but the underlying legacy `/simulations/...` files and managed `/api/library/simulations/...` file routes are intentionally readable without sign-in so simulations can open directly and load their own assets reliably. Treat those URLs as public content URLs; do not put private information in simulation packages.

Managed HTML responses and contributor ZIP previews are served with a CSP `sandbox` that permits only the capabilities simulations need (`allow-scripts`, forms, modals, pointer lock and popups) and does **not** grant same-origin privileges. The single-HTML review preview is also sandboxed. Longer term, serving uploaded simulations from a separate origin is still recommended so untrusted simulation code is physically isolated from authenticated application cookies and server actions.

## Deployment checks

Before calling the workflow production-ready, run an end-to-end staging test with real Firebase and Vercel credentials covering Google sign-in, contributor upload, validation/preview, review decisions, publishing, version history and rollback.
