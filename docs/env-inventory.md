# Environment Inventory

## Runtime variables

| Variable | Required | Purpose | Where to set it |
| --- | --- | --- | --- |
| `VITE_WIKI_API_CONTACT_EMAIL` | Recommended | Identifies the app to Wikipedia via the `Api-User-Agent` header. | Firebase Hosting build environment or local `.env.local` |
| `VITE_RECAPTCHA_SITE_KEY` | Optional | Enables client-side reCAPTCHA v3 checks for search/pathfinding abuse reduction. | Firebase Hosting build environment or local `.env.local` |

## Notes
- Local overrides belong in `.env.local`, which is ignored by git.
- `.env.example` is documentation only and should not contain real secrets.
- The app still supports the legacy `VITE_WIKI_CONTACT` key as a temporary fallback while production settings are migrated.
