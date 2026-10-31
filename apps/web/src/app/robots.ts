import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (process.env.SITE_INDEXABLE !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/api", "/login", "/signup", "/continue", "/reset-password", "/verify-email", "/forgot-password"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
