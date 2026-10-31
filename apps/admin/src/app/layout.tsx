import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Admin terminal",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Forces dynamic rendering so each response carries its own CSP nonce.
  await headers();
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f2f4f9",
          color: "#0b1433",
          fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
