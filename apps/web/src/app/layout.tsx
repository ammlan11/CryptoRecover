import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
/** Stays false until launch so staging and previews are never indexed. */
const indexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Report a Crypto Scam | Help Expose How Scams Work | Demo",
    template: "%s | Demo",
  },
  description:
    "Share your crypto scam story. Investigators study every report to expose new tactics and warn others. Free and confidential. We never offer recovery.",
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page dynamic, which per-request CSP nonces require.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const organisation = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Demo",
    url: siteUrl,
    description: "Crypto scam research: reports are studied by investigators to warn others.",
  };

  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
