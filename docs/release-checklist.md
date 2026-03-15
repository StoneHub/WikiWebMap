# Release Checklist

## Before merge
- Run `npm run check` locally or confirm an equivalent CI run passed on the exact commit.
- Confirm the PR preview deployment renders and the graph loads.
- Add a topic, open node details, and run at least one suggested-path search.
- Abort a suggested-path search and confirm the pre-search graph is restored.
- Check mobile layout for the search panel, settings, node details, and connection drawer.

## Configuration
- Verify `VITE_WIKI_API_CONTACT_EMAIL` is set in hosting.
- Verify `VITE_RECAPTCHA_SITE_KEY` is set in hosting.
- Confirm no `.env`-style secret files are tracked in git.

## Production confidence
- README live URL matches the deployed site.
- reCAPTCHA disclosure is visible in the UI.
- Unit tests passed on the exact commit being released.
- Firebase Hosting workflow passed on the exact commit being released.

## After release
- Spot-check `https://wikiconnectionsmap.web.app/` on desktop and mobile.
- Confirm Wikipedia fetches succeed and there are no obvious console errors.
- Open the diagnostics panel and confirm there are no captured runtime errors during smoke usage.
- Record any rollback instructions or incidents in the PR notes.
