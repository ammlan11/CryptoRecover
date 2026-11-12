import type { MetadataRoute } from "next";
import { SCAMS } from "@/content/scams";
import { siteUrl } from "@/lib/site";

/** Indexable pages only. Campaign landing pages (/lp/*) are deliberately left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/scams`, changeFrequency: "weekly", priority: 0.8 },
    ...SCAMS.map((s) => ({ url: `${siteUrl}/scams/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
