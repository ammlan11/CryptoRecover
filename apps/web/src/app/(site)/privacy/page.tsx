import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, OPERATOR } from "@/components/legal/Legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kuro Trace collects, protects and uses the information you share, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

/**
 * Written to match how the site actually works (encryption, consents, providers, deletion).
 * Have it reviewed by a legal adviser for UK GDPR and the laws of your main markets, and
 * keep it in step with the code: if a provider, consent or retention period changes, update it here.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p style={{ margin: 0 }}>
          Kuro Trace studies how crypto scams work and warns people about them. To do that we ask people who have
          seen or lost money to a scam to tell us what happened. This policy explains, in plain language,{" "}
          <strong>what we collect, why, who can see it, and the control you have over it.</strong>
        </p>
      }
      keyPoints={[
        <><strong>We never sell your information</strong>, and we never ask you for money, a &ldquo;recovery fee&rdquo; or your seed phrase.</>,
        <><strong>Your name and contact details are never published.</strong> If you agree, we may publish the scammer&rsquo;s wallets, websites and handles from your report, never anything that identifies you.</>,
        <><strong>Your contact details and report are encrypted</strong> before they are stored, and only our research team and our investigation partner can read them.</>,
        <><strong>We are not a recovery service.</strong> We can&rsquo;t get money back, and we&rsquo;ll never pass your details to anyone who says they can.</>,
        <><strong>You can delete your account at any time</strong> in your account settings. That deletes your reports, files and messages straight away.</>,
      ]}
      sections={[
        {
          id: "who",
          title: "Who we are",
          body: (
            <>
              <p>
                Kuro Trace (&ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;) runs kurotrace.com. We are the{" "}
                <strong>controller</strong> of the personal information described here, which means we decide how it is used and are responsible for protecting it.
              </p>
              <p>
                Contact us about privacy at <a href={`mailto:${OPERATOR.email}`}><strong>{OPERATOR.email}</strong></a>, or write to {OPERATOR.name}, {OPERATOR.address}.
              </p>
            </>
          ),
        },
        {
          id: "collect",
          title: "What we collect",
          body: (
            <>
              <h3>Information you give us</h3>
              <ul>
                <li><strong>Account details:</strong> your email address, mobile number and password. Your password is stored only as a secure scrambled value (a hash) that nobody can read, including us.</li>
                <li><strong>Your report:</strong> what happened, the type of scam, how you were contacted, your country, roughly how much was lost, the payments you made, and the wallets, websites, apps and social handles the scammer used.</li>
                <li><strong>Evidence files</strong> you choose to upload, such as screenshots and chat exports. Every file is checked for viruses before our team can open it.</li>
                <li><strong>Messages</strong> between you and our research team about your report.</li>
              </ul>
              <h3>Information collected automatically</h3>
              <ul>
                <li><strong>Security information:</strong> your IP address (stored scrambled for sign-in protection), your device and browser type for signed-in sessions, and records of sign-ins and failed attempts, so we can stop break-ins and abuse.</li>
                <li><strong>Where you came from:</strong> if you arrive from one of our adverts, the campaign tags in the link (such as <em>utm_source</em> and the ad click ID), so we know which campaigns help people find us.</li>
                <li><strong>Essential cookies</strong> that keep you signed in and remember your choices. See <a href="#cookies">Cookies and ad measurement</a>.</li>
              </ul>
              <h3>What we don&rsquo;t collect</h3>
              <p>
                <strong>Never send us your seed phrase, private keys or passwords to any exchange or wallet.</strong> We will never ask for them. The wallet checker does not save the
                addresses you look up or link them to you.
              </p>
            </>
          ),
        },
        {
          id: "why",
          title: "Why we use it, and our legal basis",
          body: (
            <>
              <p>Data protection law requires us to have a reason, called a legal basis, for each use:</p>
              <div className="legal-scroll">
                <table className="legal-table">
                  <thead><tr><th>What we do</th><th>Legal basis</th></tr></thead>
                  <tbody>
                    <tr><td>Create and run your account, sign you in, send sign-in codes and security alerts</td><td><strong>Contract</strong>: to provide the service you asked for</td></tr>
                    <tr><td>Study your report to understand how the scam works, and share it with our investigation partner</td><td><strong>Your consent</strong>, which you give when you submit a report</td></tr>
                    <tr><td>Publish the scammer&rsquo;s wallets, websites and handles in warnings and the wallet checker</td><td><strong>Your consent</strong>, a separate choice on each report</td></tr>
                    <tr><td>Contact you about your report, for example with a question from our team</td><td><strong>Contract</strong> and our <strong>legitimate interest</strong> in accurate research</td></tr>
                    <tr><td>Keep the site secure, prevent fraud, spam and abuse</td><td><strong>Legitimate interests</strong></td></tr>
                    <tr><td>Measure which adverts work</td><td><strong>Your consent</strong> (cookie banner on campaign pages)</td></tr>
                    <tr><td>Comply with the law or a valid request from the authorities</td><td><strong>Legal obligation</strong></td></tr>
                  </tbody>
                </table>
              </div>
              <p>
                Some reports reveal sensitive details about your life. <strong>Only share what is needed to describe the scam.</strong> Where a report includes special
                category information, we rely on your <strong>explicit consent</strong> and use it only for the research you agreed to.
              </p>
            </>
          ),
        },
        {
          id: "who-sees",
          title: "Who can see your information",
          body: (
            <>
              <ul>
                <li><strong>Our research team</strong>: only staff whose job is to review reports. Access is limited by role, every staff member signs in with two-step verification, and <strong>every time a report is opened it is recorded</strong> in a log that cannot be altered.</li>
                <li><strong>Our private investigation partner</strong>, who helps trace scam networks. They work under a written agreement that limits use to this research and requires them to keep the information secure.</li>
                <li><strong>Service providers</strong> that run the site for us, under contracts that only let them use the data to provide their service:</li>
              </ul>
              <div className="legal-scroll">
                <table className="legal-table">
                  <thead><tr><th>Provider</th><th>What they do</th></tr></thead>
                  <tbody>
                    <tr><td>Contabo (Germany)</td><td>Hosts our servers and encrypted backups</td></tr>
                    <tr><td>Cloudflare</td><td>Protects the site from attacks, delivers pages quickly, and runs the &ldquo;are you human?&rdquo; check</td></tr>
                    <tr><td>Hostinger</td><td>Sends our emails, such as sign-in codes and report updates</td></tr>
                    <tr><td>Meta and Google</td><td><strong>Only if you accept advertising cookies</strong> on one of our campaign pages, to measure which adverts work</td></tr>
                  </tbody>
                </table>
              </div>
              <ul>
                <li><strong>Authorities</strong>, only when the law requires it, or when sharing the scammer&rsquo;s details (not yours) helps stop serious harm, such as alerting an exchange to a scam wallet.</li>
              </ul>
              <p><strong>We do not sell, rent or trade your personal information, and we never share it with &ldquo;recovery&rdquo; companies.</strong></p>
            </>
          ),
        },
        {
          id: "publish",
          title: "What we publish",
          body: (
            <>
              <p>
                If you tick the publishing option on a report, we may publish <strong>details that identify the scam, not you</strong>: wallet addresses, website
                addresses, app names and social media handles used by the scammer, and anonymous statistics such as the number of reports about a scam type.
              </p>
              <p>
                <strong>We never publish your name, email, phone number, the text of your report or your evidence files.</strong> Our team reviews details before they are
                published. You can change your choice for future publishing at any time by contacting us.
              </p>
            </>
          ),
        },
        {
          id: "security",
          title: "How we protect it",
          body: (
            <ul>
              <li><strong>Encryption:</strong> your email, mobile number, report text, messages and files are encrypted before they are stored. All connections to the site use HTTPS.</li>
              <li><strong>Strong sign-in:</strong> a code is emailed at every sign-in, and you can add an authenticator app. Staff must use an authenticator or security key.</li>
              <li><strong>Virus scanning</strong> of every uploaded file before anyone opens it.</li>
              <li><strong>Encrypted backups</strong> that can only be opened with a key kept off the server.</li>
              <li><strong>Least access:</strong> staff only see what their role needs, and their actions are logged.</li>
            </ul>
          ),
        },
        {
          id: "keep",
          title: "How long we keep it",
          body: (
            <ul>
              <li><strong>Your account, reports, files and messages:</strong> until you delete your account or ask us to. Deleting your account removes them <strong>immediately</strong> from the live system.</li>
              <li><strong>Backups:</strong> deleted information disappears from our encrypted backups <strong>within 30 days</strong>, as old backups are replaced.</li>
              <li><strong>Sign-in codes and links</strong> expire within minutes to days and are then useless.</li>
              <li><strong>Details already published</strong> (scam wallets and websites) may stay public because they protect others, but they never identify you.</li>
              <li><strong>Security and audit logs</strong> are kept as long as needed to protect the service and investigate abuse.</li>
            </ul>
          ),
        },
        {
          id: "transfers",
          title: "International transfers",
          body: (
            <p>
              Our servers are in the <strong>European Union (Germany)</strong>. Some providers, such as Cloudflare, operate worldwide. When information leaves the UK or EU, we
              rely on <strong>approved safeguards</strong> such as the standard contractual clauses and the UK International Data Transfer Addendum.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>Depending on where you live, you have the right to:</p>
              <ul>
                <li><strong>See</strong> the information we hold about you and get a copy;</li>
                <li><strong>Correct</strong> anything that is wrong;</li>
                <li><strong>Delete</strong> your information. You can delete your account yourself in <Link href="/account/settings">account settings</Link>;</li>
                <li><strong>Withdraw consent</strong> at any time, for example to stop future publishing. This doesn&rsquo;t affect what was done before;</li>
                <li><strong>Object to</strong> or <strong>restrict</strong> some uses, and <strong>move</strong> your data to another service;</li>
                <li><strong>Complain</strong> to a data protection authority. In the UK that is the Information Commissioner&rsquo;s Office (ico.org.uk). Please contact us first so we can try to help.</li>
              </ul>
              <p>
                To use these rights, email <a href={`mailto:${OPERATOR.email}`}><strong>{OPERATOR.email}</strong></a> from the address on your account. We reply{" "}
                <strong>within one month</strong>, and it&rsquo;s free.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and ad measurement",
          body: (
            <>
              <p>We use a small number of cookies:</p>
              <ul>
                <li><strong>Essential cookies</strong> keep you signed in, protect forms from bots and remember which campaign brought you. The site can&rsquo;t work without them.</li>
                <li><strong>Advertising cookies</strong> (Meta and Google) are used <strong>only on our campaign pages and only if you accept them</strong>. They are never used on report, account or other pages.</li>
              </ul>
            </>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: <p>Kuro Trace is for people aged <strong>16 and over</strong>. If you are younger, please ask a parent or guardian to report the scam for you.</p>,
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              If we change how we use your information, we&rsquo;ll update this page and the date at the top. <strong>For important changes we&rsquo;ll email you</strong>{" "}
              before they take effect.
            </p>
          ),
        },
      ]}
    />
  );
}
