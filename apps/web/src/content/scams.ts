/**
 * Scam playbooks. Each becomes /scams/<slug>. Original copy; keep it plain,
 * specific and free of recovery promises.
 */

export interface ScamPlaybook {
  slug: string;
  name: string;
  tag: string;
  danger?: boolean;
  card: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  stages: { title: string; body: string }[];
  redFlags: string[];
  faq: { q: string; a: string }[];
}

export const SCAMS: ScamPlaybook[] = [
  {
    slug: "pig-butchering",
    name: "Pig butchering scams",
    tag: "Most reported",
    danger: true,
    card: "Weeks of friendly chat, then a can't-lose trading tip.",
    seoTitle: "Pig Butchering Scam: How It Works and the Warning Signs",
    seoDescription:
      "How pig butchering crypto scams build trust over weeks, move you onto a fake trading platform, then demand fees to withdraw. Learn the stages and red flags.",
    intro:
      "A pig butchering scam starts as a friendship or romance and ends with a fake investment. The name comes from the scammers themselves: they spend weeks \"fattening\" a target with attention before taking as much as they can.",
    stages: [
      { title: "A message out of nowhere", body: "A wrong-number text, a dating match or a friendly comment on social media. The person is warm, patient and in no hurry." },
      { title: "Trust, then a hint of wealth", body: "Over days or weeks they share their life, and mention how well they do from crypto trading, often with an \"uncle\" or \"mentor\" who knows the market." },
      { title: "A small, successful test", body: "They walk you through buying crypto and sending it to a trading site or app. The first small deposit grows quickly and a small withdrawal may even work." },
      { title: "Bigger deposits", body: "With proof it works, you are encouraged to invest more, sometimes borrowing or using savings. The balance on screen keeps climbing." },
      { title: "The trap closes", body: "When you try to withdraw, a \"tax\", \"fee\" or \"verification deposit\" is suddenly required. Paying it leads to another fee. The account is then frozen and the contact disappears." },
    ],
    redFlags: [
      "Someone you have never met in person brings up crypto investing",
      "They steer you to a specific app or website you hadn't heard of",
      "Early profits look unusually smooth and fast",
      "Withdrawing requires a new payment first",
      "They become upset or pushy when you hesitate",
    ],
    faq: [
      { q: "Is the trading platform real?", a: "In these scams the platform is built by the scammers. The balance you see is just a number on their screen; the crypto you sent went to their wallets." },
      { q: "Should I pay the fee to release my money?", a: "No. Every reported case we know of ends with more fees, not a withdrawal. Stop sending money and share what happened." },
    ],
  },
  {
    slug: "fake-trading-apps",
    name: "Fake crypto trading apps",
    tag: "Platforms",
    card: "Profits climb on screen; cashing out costs a \"fee\" first.",
    seoTitle: "Fake Crypto Trading Apps: How to Spot a Fake Exchange",
    seoDescription:
      "Fake crypto exchanges and trading apps show rising profits that can never be withdrawn. Learn how they work, how to check a platform, and the red flags.",
    intro:
      "Fake trading apps and websites copy the look of real exchanges. They let you deposit easily, show impressive gains, and make withdrawing impossible without paying more.",
    stages: [
      { title: "A polished platform", body: "A professional website or app, sometimes in app stores, often promoted in ads, groups or by a contact you met online." },
      { title: "Easy deposits", body: "You are asked to send crypto, usually USDT, to an address the platform gives you. There is rarely a way to pay by card or bank transfer." },
      { title: "Numbers that only go up", body: "Your dashboard shows steady profits. Some apps add \"VIP levels\" that reward bigger deposits." },
      { title: "The withdrawal wall", body: "Cashing out triggers an unexpected charge: tax, anti-money-laundering checks, a minimum balance, or an \"account upgrade\"." },
    ],
    redFlags: [
      "The platform does not appear on your country's financial regulator register",
      "Deposits only in crypto, sent to an address they give you",
      "Customer support only on Telegram or WhatsApp",
      "The domain is new, or very similar to a well-known exchange",
      "You must pay before you can withdraw your own balance",
    ],
    faq: [
      { q: "How can I check if an exchange is real?", a: "Search your financial regulator's register for the exact company name and website, check how old the domain is, and paste the site into our checker." },
      { q: "The app is in the app store. Doesn't that make it safe?", a: "No. Fake trading apps regularly get through app store review before being removed." },
    ],
  },
  {
    slug: "telegram-whatsapp-broker",
    name: "Telegram and WhatsApp broker scams",
    tag: "Messaging",
    card: "An \"account manager\" who only ever needs more.",
    seoTitle: "Telegram Crypto Broker Scam: Fake Mentors and Account Managers",
    seoDescription:
      "Fake crypto brokers and trading mentors on Telegram and WhatsApp promise managed returns, then demand fees. How the scam works and how to recognise it.",
    intro:
      "Broker scams run through messaging apps. A \"mentor\", \"analyst\" or \"account manager\" offers to trade for you, shares screenshots of big wins, and keeps finding reasons for you to send more.",
    stages: [
      { title: "Invitation to a group", body: "You are added to a trading group or receive a message offering signals, coaching or a managed account." },
      { title: "Social proof", body: "The group is full of members posting profits. Many of them are fake accounts run by the same people." },
      { title: "Your personal manager", body: "A manager takes you private, opens an account for you on their platform and suggests a starting amount." },
      { title: "Escalation", body: "Profits appear. To unlock higher tiers, cover a \"margin call\" or withdraw, you are told to deposit again." },
    ],
    redFlags: [
      "Unsolicited trading advice in a private message",
      "Guaranteed or fixed returns",
      "A group where everyone seems to be winning",
      "Pressure to deposit before a deadline",
      "Requests to move the conversation off public channels",
    ],
    faq: [
      { q: "Are all crypto groups on Telegram scams?", a: "No, but anyone who messages you privately offering to manage your money or guarantee returns should be treated as a scam until proven otherwise." },
      { q: "They sent me screenshots of their profits. Are they real?", a: "Screenshots are easy to fake and prove nothing. Scam groups use them constantly." },
    ],
  },
  {
    slug: "recovery-scams",
    name: "Crypto recovery scams",
    tag: "Second hit",
    danger: true,
    card: "A stranger promises your lost crypto back, for a payment upfront.",
    seoTitle: "Crypto Recovery Scams: Why \"We'll Get Your Money Back\" Is a Trap",
    seoDescription:
      "After a crypto scam, fake recovery services target victims again with promises to trace and return funds for an upfront fee. How to recognise a recovery scam.",
    intro:
      "Recovery scams target people who have already lost money. Someone claims they can trace and return your crypto, for a fee paid first. It is often the same network behind the original scam, hitting the same person twice.",
    stages: [
      { title: "They find you", body: "You get a message, see an ad, or are contacted in a comment thread after posting about being scammed. Some pose as lawyers, hackers or government agencies." },
      { title: "A convincing story", body: "They claim special tools or insider access, may show a fake \"trace report\" and say your funds have been located." },
      { title: "Fees to release it", body: "Payment is needed for legal costs, a release fee, gas, or a percentage upfront. More charges follow." },
    ],
    redFlags: [
      "Anyone guaranteeing they can recover crypto",
      "Payment requested upfront, especially in crypto",
      "They contacted you first, after you posted about your loss",
      "Claims of hacking, insider access or government connections",
      "Pressure to act before your funds are \"moved again\"",
    ],
    faq: [
      { q: "Does Kuro Trace recover money?", a: "No. Kuro Trace is a research project. We study scams to warn others, and we never charge or offer recovery." },
      { q: "Can anyone trace stolen crypto?", a: "Blockchain analysis can show where funds moved, but that does not mean anyone can return them. Report to your police and to the exchange the funds reached." },
    ],
  },
  {
    slug: "wallet-drainers",
    name: "Wallet drainer and phishing scams",
    tag: "Wallets",
    card: "One signature on a fake airdrop empties the wallet.",
    seoTitle: "Wallet Drainer Scams: Fake Airdrops, Mints and Phishing Links",
    seoDescription:
      "Wallet drainers trick you into signing a transaction that hands over your crypto. Learn how fake airdrops and phishing links work and how to protect your wallet.",
    intro:
      "A wallet drainer is a malicious site that asks you to connect your wallet and sign something. That signature gives it permission to move your tokens or NFTs, often within seconds.",
    stages: [
      { title: "A tempting link", body: "A free airdrop, an exclusive mint, a \"wallet sync\" or a support link, shared through ads, hacked social accounts or direct messages." },
      { title: "Connect and sign", body: "The page asks you to connect your wallet and approve a transaction or message that looks routine." },
      { title: "Drained", body: "The approval lets the attacker transfer your assets. It usually happens immediately and cannot be reversed." },
    ],
    redFlags: [
      "Free tokens you didn't expect",
      "Links from accounts that just started posting about a giveaway",
      "Requests to sign transactions you don't fully understand",
      "\"Support\" asking you to validate or sync your wallet",
      "Anyone asking for your seed phrase, ever",
    ],
    faq: [
      { q: "I signed something. What now?", a: "Move any remaining assets to a new wallet immediately and revoke token approvals from the old one. Then share what happened so we can flag the site." },
      { q: "Will real projects ever ask for my seed phrase?", a: "Never. A seed phrase gives full control of a wallet. Anyone asking for it is stealing." },
    ],
  },
  {
    slug: "impersonation",
    name: "Impersonation scams",
    tag: "Fake authority",
    card: "Fake exchanges, banks, officials or celebrities asking for crypto.",
    seoTitle: "Crypto Impersonation Scams: Fake Exchanges, Banks and Celebrities",
    seoDescription:
      "Scammers pose as exchanges, banks, government officials or celebrities to get you to send crypto. How impersonation scams work and how to verify who you're dealing with.",
    intro:
      "Impersonation scams borrow a trusted name: your exchange's support team, your bank's fraud department, a tax authority, or a famous investor. The goal is to make an urgent request feel official.",
    stages: [
      { title: "An official-looking contact", body: "A call, email, text or social account using a familiar name and logo, sometimes with a spoofed phone number." },
      { title: "Urgency", body: "Your account is \"compromised\", you owe a \"fine\", or there is a limited-time \"giveaway\" that doubles what you send." },
      { title: "The ask", body: "Move your funds to a \"safe wallet\", pay in crypto, or share a code or seed phrase to \"verify\" your identity." },
    ],
    redFlags: [
      "Unexpected contact claiming to be from a company or authority",
      "Requests to move funds to a new wallet for safety",
      "Payments demanded in crypto or gift cards",
      "Giveaways that promise to send back more than you send",
      "Pressure not to hang up or check with anyone",
    ],
    faq: [
      { q: "How do I check if a call is really from my exchange?", a: "Hang up and contact the company through the app or website you already use. Never use the number or link the caller gives you." },
      { q: "A celebrity is giving away crypto. Is it real?", a: "No legitimate giveaway asks you to send crypto first. These are always scams." },
    ],
  },
];

export function getScam(slug: string) {
  return SCAMS.find((s) => s.slug === slug);
}
