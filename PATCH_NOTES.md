# Simulation Library contributor/review UX patch

## Changes included

1. Automated-check explanations
   - Every check on the admin submission review page now has an `i` control.
   - Opening it shows **What this means** and **Why it matters**.
   - `PACKAGE_CONTENTS` now explicitly says that `INFO` is informational only and does not require a correction by itself.

2. Revise and resubmit an existing submission
   - Contributor history now shows **Make changes** for `needs-changes` submissions.
   - Contributor history now shows **Edit & resubmit** for `rejected` / Not accepted submissions.
   - The existing submission is reopened with its metadata prefilled and the latest reviewer feedback visible.
   - A corrected HTML/ZIP is uploaded against the same submission record rather than creating a duplicate application.
   - The replacement is only committed after the new upload succeeds. An interrupted upload therefore leaves the prior submission usable for another retry.
   - Previous reviewer feedback is retained in a review-history field and displayed to admins after resubmission.
   - Superseded private staging blobs are deleted after the revised upload validates.

3. Drag-and-drop upload
   - The contribution upload box now supports drag-and-drop as well as the existing file picker.
   - Existing 10 MB and HTML/ZIP checks still apply.

## Data/backend impact

- Backend remains Firebase/Firestore + Vercel Blob.
- No Supabase changes are involved.
- No Firestore schema migration is required because Firestore is schemaless.
- New optional submission fields may appear on revised records: `revisionNumber`, `resubmittedAt`, `reviewHistory`, and the short-lived server-side `pendingRevision` field during upload preparation.
- No new environment variables are required.

## Validation performed

- TypeScript/TSX syntax was parsed with the available global TypeScript compiler. The changed files produced only expected unresolved-module errors because project dependencies were not installed in this sandbox; no syntax errors were reported.
- `npm install` could not complete in the sandbox within the available execution window, so the normal project `npm run lint` / `npm run build` could not be run here.

## Recommended deployment check

After applying the patch in the normal repository environment:

1. `npm install`
2. `npm run lint`
3. `npm run build`
4. Deploy to staging/preview.
5. Test one `needs-changes` resubmission and one `rejected` resubmission end to end, including reviewer history and preview.
6. Test drag-and-drop with both a standalone HTML file and a ZIP project.
