import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, OPERATOR } from "@/components/legal/Legal";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using Kuro Trace, and how we may use the information you share and the information we publish.",
  alternates: { canonical: "/terms" },
};

/** Have these reviewed by a legal adviser (consumer law in England and your main markets). */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p style={{ margin: 0 }}>
          These terms are the agreement between you and Kuro Trace when you use kurotrace.com. They cover{" "}
          <strong>what the service is, how we may use the information you share, how you may use the information we publish</strong>, and the rules that keep
          the service safe. <strong>By using the site or creating an account, you agree to them.</strong>
        </p>
      }
      keyPoints={[
        <><strong>Kuro Trace is a research service, not a recovery service.</strong> We cannot get your money back, and we don&rsquo;t give legal or financial advice.</>,
        <><strong>It is free.</strong> We will never charge you or ask for a fee, your seed phrase or private keys. Anyone who does is not us.</>,
        <><strong>Only report what is true</strong> and what you have the right to share.</>,
        <><strong>You keep ownership of your report.</strong> You let us use it for scam research and, if you agree, to publish the scammer&rsquo;s details, never yours.</>,
        <><strong>&ldquo;No reports found&rdquo; does not mean safe.</strong> Our warnings and wallet checker are information only.</>,
      ]}
      sections={[
        {
          id: "service",
          title: "What Kuro Trace is, and isn't",
          body: (
            <>
              <p>
                Kuro Trace collects reports about crypto scams so that our research team and investigation partner can understand how scams operate, and so we can
                publish warnings that help others avoid them.
              </p>
              <ul>
                <li><strong>We are not a fund recovery service.</strong> We do not promise, and cannot arrange, the return of lost money.</li>
                <li><strong>We are not the police, a regulator or a law firm.</strong> Please also report the scam to your local police, your bank and the platform involved.</li>
                <li><strong>We do not give legal, financial or investment advice.</strong></li>
                <li><strong>We never charge</strong> and never ask for payment, a &ldquo;recovery fee&rdquo;, your seed phrase or your private keys. Messages claiming to be from us that ask for these are scams. Please report them to us.</li>
              </ul>
            </>
          ),
        },
        {
          id: "eligibility",
          title: "Who can use it",
          body: <p>You must be <strong>18 or older</strong> to create an account or submit a report. You can use the public pages and the wallet checker at any age.</p>,
        },
        {
          id: "account",
          title: "Your account",
          body: (
            <ul>
              <li>Give us a <strong>real email address and mobile number</strong> that you control. We use them to sign you in and to contact you about your reports.</li>
              <li><strong>Keep your password and sign-in codes private.</strong> Our staff will never ask you for them.</li>
              <li>An account is for <strong>one person</strong>. Tell us straight away if you think someone else has used it.</li>
              <li>You can <strong>delete your account at any time</strong> in your account settings.</li>
            </ul>
          ),
        },
        {
          id: "your-info",
          title: "What you share with us",
          body: (
            <>
              <p>When you submit a report, upload evidence or message our team, you confirm that:</p>
              <ul>
                <li>it is <strong>true and accurate</strong> to the best of your knowledge. <strong>Deliberately false or malicious reports are not allowed</strong> and may be removed;</li>
                <li>you have the <strong>right to share it</strong>, for example screenshots of conversations you took part in;</li>
                <li>you only include other people&rsquo;s personal details where they are <strong>needed to describe the scam</strong> (such as the name or handle the scammer used);</li>
                <li>it contains <strong>no viruses or harmful files</strong>, and nothing illegal to possess or share.</li>
              </ul>
            </>
          ),
        },
        {
          id: "use-of-info",
          title: "How we may use the information you share",
          body: (
            <>
              <p><strong>You keep ownership of your report and files.</strong> By submitting them, you give Kuro Trace a free, non-exclusive, worldwide permission to:</p>
              <ul>
                <li><strong>store, read and analyse</strong> them, and combine them with other reports to find patterns, scam networks and the people behind them;</li>
                <li><strong>share them with our investigation partner</strong>, who is bound to use them only for this research and to keep them secure;</li>
                <li><strong>publish anonymous findings</strong>, such as statistics, scam types and common tactics, that do not identify you;</li>
                <li><strong>if you tick the publishing option</strong>, publish the scammer&rsquo;s wallet addresses, websites, apps and handles from your report in warnings and the wallet checker;</li>
                <li><strong>share the scammer&rsquo;s details</strong> (not yours) with exchanges, platforms or authorities where that can help stop the scam or is required by law.</li>
              </ul>
              <p>
                <strong>We will never publish your name, contact details, the text of your report or your evidence files</strong>, and we will never sell them. How we handle
                personal information is explained in full in our <Link href="/privacy"><strong>Privacy Policy</strong></Link>.
              </p>
              <p>
                You can withdraw your publishing permission for the future at any time. Details that have <strong>already been published or shared</strong> to warn others may
                not be fully withdrawable, but they never identify you. If you delete your account, we delete your reports and files.
              </p>
            </>
          ),
        },
        {
          id: "our-info",
          title: "Using the information we publish",
          body: (
            <>
              <p>Our scam alerts, guides and the wallet checker are provided <strong>for information only</strong>.</p>
              <ul>
                <li><strong>A result is not proof.</strong> A listing means the address or site was reported to us, confirmed by our team, or appears on a public list such as the US sanctions list. It is not a court finding.</li>
                <li><strong>No result does not mean safe.</strong> New scams appear every day. Always take care before sending money.</li>
                <li>You may <strong>read, share and link to</strong> our published warnings for personal and non-commercial use, with a link back to kurotrace.com.</li>
                <li><strong>You may not</strong> copy our data in bulk, scrape the site, resell our data, or use it to harass, threaten or take the law into your own hands against anyone.</li>
              </ul>
              <h3>Think something we list is wrong?</h3>
              <p>
                If you believe a wallet, website or handle has been listed by mistake, email <a href={`mailto:${OPERATOR.email}`}><strong>{OPERATOR.email}</strong></a> with
                the details and why. <strong>We review every request</strong> and correct or remove listings that are wrong.
              </p>
            </>
          ),
        },
        {
          id: "rules",
          title: "Rules for using the site",
          body: (
            <>
              <p>You must not:</p>
              <ul>
                <li>try to <strong>break into</strong> accounts or our systems, test our security without written permission, or get around limits and bot checks;</li>
                <li>use <strong>bots, scrapers or automated tools</strong> to access the site, except normal search engines;</li>
                <li><strong>pretend to be someone else</strong>, including Kuro Trace or our staff;</li>
                <li>submit <strong>false reports</strong>, spam, or reports meant to harm an innocent person or business;</li>
                <li>use Kuro Trace for anything <strong>illegal</strong>.</li>
              </ul>
              <p>
                We may <strong>suspend or close an account</strong> that breaks these rules, and remove content that does. Found a security problem? Please tell us at{" "}
                <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> rather than testing it further.
              </p>
            </>
          ),
        },
        {
          id: "ours",
          title: "Our content and name",
          body: <p>The Kuro Trace name, logo, design and our own writing belong to us. <strong>Don&rsquo;t use them in a way that suggests we endorse you</strong> or that you are part of Kuro Trace.</p>,
        },
        {
          id: "availability",
          title: "Availability and changes to the service",
          body: <p>We work hard to keep Kuro Trace available and accurate, but <strong>we can&rsquo;t promise it will always be available or error-free</strong>. We may change or stop features, and we&rsquo;ll give notice of major changes where we can.</p>,
        },
        {
          id: "liability",
          title: "Our responsibility to you",
          body: (
            <>
              <p>
                The service is free and provided for research and information. To the extent the law allows, <strong>we are not responsible for losses caused by scams,
                by decisions you make based on our information, or by things outside our reasonable control</strong>.
              </p>
              <p>
                <strong>Nothing in these terms limits liability that cannot legally be limited</strong>, such as for death or personal injury caused by negligence, or for
                fraud, and nothing affects your legal rights as a consumer.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: <p>We may update these terms. We&rsquo;ll change the date at the top, and <strong>for important changes we&rsquo;ll email account holders</strong> before they take effect. If you keep using Kuro Trace after that, the new terms apply.</p>,
        },
        {
          id: "law",
          title: "Law and disputes",
          body: (
            <p>
              These terms are governed by the <strong>laws of England and Wales</strong>, and the courts of England and Wales can hear disputes. If you live elsewhere,
              you keep any protections that the law of your country gives you and can bring a claim there. <strong>Please contact us first</strong>; most problems can be
              solved quickly.
            </p>
          ),
        },
      ]}
    />
  );
}
