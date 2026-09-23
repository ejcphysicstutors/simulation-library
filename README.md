# EJC Physics Simulation Library

New-generation simulation library for EJC Physics.

## Architecture decisions

- Next.js application deployed on Vercel.
- Firebase Authentication for Google sign-in.
- Cloud Firestore for roles, taxonomy, simulation metadata, submissions, versions and validation results.
- Firebase Storage for private incoming uploads and screenshots.
- Teacher-uploaded simulation code will run on a separate origin from the application/admin portal.
- Approved EJC Google-account domains receive student access automatically.
- Contributor/admin access is explicitly allowlisted in Firestore.
- `INITIAL_ADMIN_EMAILS` provides a server-side bootstrap admin list so the first admin never needs to be hard-coded in GitHub.
- External demo access is read-only and protected by a server-side shared password with a short-lived signed session cookie.
- Firestore is wrapped behind a data-access layer so a future SQL migration remains possible.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Firebase web app configuration values.
3. Create a Firebase service account and add the Admin SDK values to `.env.local` / Vercel environment variables.
4. Set `NEXT_PUBLIC_STUDENT_EMAIL_DOMAINS` to the Google-account domain(s) that receive student access.
5. Put your own email in `INITIAL_ADMIN_EMAILS` for the first deployment.
6. Set `DEMO_ACCESS_PASSWORD` (and optionally `DEMO_SESSION_SECRET`).
7. In Firebase Authentication, enable the **Google** sign-in provider and add your deployed Vercel domain to authorised domains.
8. Run `npm install` then `npm run dev`.

## Access model

- **Student**: any Google account on an approved EJC domain.
- **Contributor**: explicit Firestore access record; can access `/contribute`.
- **Admin**: explicit Firestore access record or bootstrap email; includes contributor access and can manage access at `/admin/access`.
- **Demo**: shared-password, read-only student view only.

Privileged Firestore records live at:

`access_users/{normalised-email}`

with fields `email`, `role`, `active`, timestamps and the admin who made the change.

The starter catalogue remains intentionally small while legacy simulations are audited and repaired.
