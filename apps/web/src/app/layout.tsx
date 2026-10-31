import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { JsonLd } from "@/components/JsonLd";
import { siteUrl, indexable } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Report a Crypto Scam | Help Expose How Scams Work | Demo",
    template: "%s | Demo",
  },
  description:
    "Share your crypto scam story. Investigators study every report to expose new tactics and warn others. Free and confidential. We never offer recovery.",
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { type: "website", siteName: "Demo", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#020b33" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${siteUrl}/#org`,
                name: "Demo",
                url: siteUrl,
                description: "Crypto scam research: reports are studied by investigators to warn others.",
              },
              { "@type": "WebSite", "@id": `${siteUrl}/#website`, name: "Demo", url: siteUrl, publisher: { "@id": `${siteUrl}/#org` } },
            ],
          }}
        />
      </body>
    </html>
  );
}
