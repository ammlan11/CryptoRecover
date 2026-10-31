export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Stays false until launch so staging and previews are never indexed. */
export const indexable = process.env.SITE_INDEXABLE === "true";
