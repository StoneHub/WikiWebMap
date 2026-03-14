const readEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

// Keep the legacy key as a temporary fallback so production stays stable
// while hosting settings are migrated to the standardized contract.
const legacyWikiContact = readEnv(import.meta.env.VITE_WIKI_CONTACT as string | undefined);

export const runtimeConfig = {
  wikiApiContactEmail:
    readEnv(import.meta.env.VITE_WIKI_API_CONTACT_EMAIL as string | undefined) ?? legacyWikiContact,
  recaptchaSiteKey: readEnv(import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined),
};
