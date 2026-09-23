# EJC Physics Simulation Library

New-generation simulation library for EJC Physics.

## Architecture decisions

- Next.js application deployed on Vercel.
- Firebase Authentication for Google sign-in.
- Cloud Firestore for roles, taxonomy, simulation metadata, submissions, versions and validation results.
- Firebase Storage for private incoming uploads and screenshots.
- Teacher-uploaded simulation code will run on a separate origin from the application/admin portal.
- Ordinary approved EJC Google accounts receive student access.
- Contributor/admin access is explicitly allowlisted.
- External demo access is read-only and protected by a server-side shared password.
- Firestore is wrapped behind a data-access layer so a future SQL migration remains possible.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add Firebase web app configuration values.
3. Run `npm install`.
4. Run `npm run dev`.

The starter currently uses a small in-code migration sample while the legacy simulations are audited and repaired.
