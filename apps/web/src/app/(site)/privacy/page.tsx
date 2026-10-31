import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Demo collects, protects and uses the information you share.",
  alternates: { canonical: "/privacy" },
  robots: { index: false },
};

/**
 * DRAFT structure only. Must be replaced with text approved by your legal adviser
 * before launch (GDPR / UK GDPR and the laws of each target market).
 */
export default function PrivacyPage() {
  return (
    <section className="light section">
      <div className="wrap article">
        <p style={{ background: "#fff1d6", color: "#7a4b00", padding: "12px 16px", borderRadius: 8, fontWeight: 500 }}>
          Draft: this notice is a placeholder and must be replaced by legal-approved text before launch.
        </p>
        <h1>Privacy notice</h1>
        <p className="lead">Demo is a crypto scam research project run by [Legal entity], [registered address]. Contact: [privacy email].</p>
        <h2>What we collect</h2>
        <p>[Email address; the scam report you submit, including wallets, websites and handles; optional evidence files; technical data such as IP address for security and rate limiting; campaign source (UTM, gclid, fbclid) when you arrive from an ad.]</p>
        <h2>Why we use it</h2>
        <p>[To study how scams operate and publish warnings (research, with your consent); to contact you about your report; to send the weekly scam alert if you subscribe; to keep the service secure.]</p>
        <h2>Who sees it</h2>
        <p>[Our in-house research team and our private investigation partner, [Investigation firm], under a data-processing agreement. Confirmed scam wallets and websites may be published and shared with [exchanges / platforms / authorities]. Your name and contact details are never published.]</p>
        <h2>How we protect it</h2>
        <p>Contact details and report text are encrypted before they are stored. Access is limited to the people reviewing reports, and every staff action is logged.</p>
        <h2>How long we keep it</h2>
        <p>[Retention period for reports, leads and newsletter subscriptions.]</p>
        <h2>Your rights</h2>
        <p>[Access, correction, deletion, objection, withdrawal of consent, and complaint to your data protection authority. How to make a request.]</p>
      </div>
    </section>
  );
}
