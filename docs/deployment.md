# Deployment Notes

## Hosting model
- Production hosting is Firebase Hosting.
- GitHub Actions is the deployment path for both preview validation and live release.
- The current public deployment is `https://wikiconnectionsmap.web.app/`.

## Custom domain / Bluehost note
- This repo does not contain Bluehost deployment automation.
- Treat Bluehost as DNS or custom-domain management unless there is separate hosting infrastructure outside this repository.
- Confirm the custom-domain setup in Bluehost before changing DNS, certificates, or redirects.

## Branch and release flow
1. Open a pull request against `main`.
2. Let CI run lint, build, and smoke coverage.
3. Review the Firebase preview deployment from the PR workflow.
4. Merge only after preview validation passes.
5. Live deployment happens from `main` after CI passes.

## Required repository settings
- Protect `main` so direct pushes are restricted.
- Require the Firebase Hosting workflow to pass before merge.
- Keep the Firebase service-account secret scoped to repository admins.

## Environment contract
- `VITE_WIKI_API_CONTACT_EMAIL`
- `VITE_RECAPTCHA_SITE_KEY`

## Rollback
- Revert the offending commit on a branch, open a PR, and let CI re-deploy.
- If an immediate rollback is needed, re-run the workflow from the last known good commit.
