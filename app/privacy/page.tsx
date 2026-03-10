import type { Metadata } from "next"
import { Header } from "@/components/header"

export const metadata: Metadata = {
  title: "Privacy Policy | Knead",
  description:
    "Knead Publishing LLC privacy policy covering data collection, third-party services, user rights, and compliance with GDPR and COPPA.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-adonis text-4xl md:text-5xl mb-4">Privacy Policy</h1>
            <p className="font-georgia-pro text-gray-500 text-sm mb-2">Last Updated: March 10, 2026</p>
            <p className="font-georgia-pro text-gray-600 italic mb-12 leading-relaxed">
              These terms were last updated on March 10, 2026. We recommend reviewing them regularly. If you have
              questions, contact us at{" "}
              <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                info@kneadmag.com
              </a>
              .
            </p>

            {/* Introduction */}
            <div className="mb-12">
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                Knead Publishing LLC ("Knead," "we," "us," or "our") operates the Knead magazine platform at
                kneadmag.com. This Privacy Policy explains how we collect, use, disclose, and protect your information
                when you use our services. By using Knead, you agree to the practices described in this policy.
              </p>
            </div>

            {/* Data We Collect */}
            <div className="mb-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">1. Data We Collect</h2>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Wallet Addresses</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                Authentication on Knead is powered by ThirdWeb, which requires connecting a blockchain wallet. Your
                wallet address is collected and stored as your primary identifier. This is required to use the platform.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Email Addresses</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                Providing an email address is optional. If you choose to provide one—for example, during payment via
                Stripe or when subscribing to our newsletter—we store it to communicate with you about your account,
                your subscription, and editorial updates. You may opt out of marketing emails at any time using the
                unsubscribe link included in every email.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Chat Messages</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                Messages sent in the Knead community chat are encrypted and stored via the Towns Protocol on-chain.
                Because this data is stored on a public blockchain, it is permanent and cannot be deleted. Please do
                not share sensitive personal information in chat.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">User Profiles</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                When you set up a profile, we store your chosen alias, avatar, and bio in our Supabase database. This
                information is associated with your wallet address and displayed to other users within the platform.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Payment Information</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                Subscription payments are processed by Stripe. We do not store your credit card number, CVV, or full
                billing address on our servers. Stripe may collect and retain payment data in accordance with their own
                privacy policy. We receive confirmation of successful payments and basic billing details from Stripe.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Blockchain Data</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                We query publicly available blockchain data to verify NFT ownership, token balances, and transaction
                history on the Base network. This data is inherently public by the nature of blockchain technology.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Usage Data & Analytics</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                We use Vercel Analytics to collect aggregated, anonymized usage data such as page views, referrer
                information, and device type. This helps us improve the platform. We do not use this data to
                individually identify you.
              </p>

              <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-3">Local Storage</h3>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                We use your browser's local storage to remember email preferences and to track freemium session usage
                (e.g., the number of free articles read this month). This data stays on your device and is not
                transmitted to our servers.
              </p>
            </div>

            {/* Third-Party Services */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">2. Third-Party Services</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                We rely on the following third-party services to operate Knead. Each has its own privacy policy and
                data practices:
              </p>
              <ul className="space-y-4">
                {[
                  {
                    name: "Stripe",
                    desc: "Payment processing for subscriptions. Stripe collects billing information directly from you.",
                    url: "https://stripe.com/privacy",
                  },
                  {
                    name: "ThirdWeb",
                    desc: "Wallet connection and blockchain interactions used for authentication and NFT features.",
                    url: "https://thirdweb.com/privacy",
                  },
                  {
                    name: "Towns Protocol",
                    desc: "Encrypted, on-chain community chat messaging. Messages stored on-chain are immutable.",
                    url: "https://towns.com/privacy",
                  },
                  {
                    name: "Supabase",
                    desc: "Database hosting for user profiles, events, and moderation logs.",
                    url: "https://supabase.com/privacy",
                  },
                  {
                    name: "IPFS",
                    desc: "Decentralized file storage used for avatars and attachments.",
                    url: "https://ipfs.tech",
                  },
                  {
                    name: "Resend",
                    desc: "Transactional and marketing email delivery.",
                    url: "https://resend.com/privacy",
                  },
                  {
                    name: "Vercel",
                    desc: "Platform hosting and aggregated analytics.",
                    url: "https://vercel.com/legal/privacy-policy",
                  },
                ].map(({ name, desc }) => (
                  <li key={name} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    <span className="font-semibold">{name}</span> — {desc}
                  </li>
                ))}
              </ul>
            </div>

            {/* How We Use Your Data */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">3. How We Use Your Data</h2>
              <ul className="space-y-3 list-disc list-inside">
                {[
                  "Authenticate you and manage your account",
                  "Verify membership eligibility (NFT ownership, subscription status)",
                  "Process payments and manage subscriptions",
                  "Deliver transactional and marketing emails (with your consent)",
                  "Display your profile and chat activity to other users",
                  "Moderate community chat and enforce our Terms of Service",
                  "Improve the platform through aggregated analytics",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Your Rights */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">4. Your Rights</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="space-y-3 list-disc list-inside mb-6">
                {[
                  "Right to access the personal data we hold about you",
                  "Right to request correction of inaccurate data",
                  "Right to request deletion of your data from our systems (note: blockchain data is immutable and cannot be deleted)",
                  "Right to opt out of marketing emails at any time",
                  "Right to data portability where technically feasible",
                  "Right to lodge a complaint with your local data protection authority (for EU users)",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                  info@kneadmag.com
                </a>
                .
              </p>
            </div>

            {/* International Compliance / GDPR */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">5. International Compliance (GDPR)</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                If you are located in the European Economic Area (EEA) or United Kingdom, you have additional rights
                under the General Data Protection Regulation (GDPR), including the right to be forgotten and the right
                to data portability. We process your data under the lawful bases of contractual necessity (to provide
                our services), consent (for marketing emails), and legitimate interests (for platform security and
                analytics).
              </p>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                To exercise your GDPR rights or submit a data subject request, contact us at{" "}
                <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                  info@kneadmag.com
                </a>
                . We will respond within 30 days.
              </p>
            </div>

            {/* Children's Privacy / COPPA */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">6. Children's Privacy (COPPA)</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                Knead is not intended for children under the age of 13. We do not knowingly collect personal
                information from children under 13. If we learn that we have inadvertently collected such information,
                we will delete it promptly. If you believe a child under 13 has provided us with personal information,
                please contact us at{" "}
                <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                  info@kneadmag.com
                </a>
                .
              </p>
            </div>

            {/* Blockchain Immutability */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">7. Blockchain Data Immutability</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                Some data associated with your use of Knead—including chat messages stored via Towns Protocol and NFT
                transactions on the Base network—is recorded on a public blockchain. By its nature, blockchain data is
                permanent, immutable, and publicly visible. We cannot delete or modify this data on your behalf. Please
                be mindful of what you share in community chat and on-chain.
              </p>
            </div>

            {/* Cookies & Tracking */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">8. Cookies & Tracking</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                We use cookies and similar technologies to keep you logged in, remember preferences, and collect
                aggregated analytics. We do not use third-party advertising cookies or sell your data to advertisers.
              </p>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                You may disable cookies in your browser settings, but doing so may affect the functionality of the
                platform.
              </p>
            </div>

            {/* Data Retention */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">9. Data Retention</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                We retain your account data for as long as your account is active or as needed to provide our services.
                If you request account deletion, we will remove your data from our servers within 30 days, subject to
                legal retention requirements and the inherent immutability of any data stored on-chain. Stripe may
                retain billing records as required by financial regulations.
              </p>
            </div>

            {/* Accessibility */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">10. Accessibility</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                We are committed to making kneadmag.com accessible to all users, including those with disabilities. We
                aim to comply with WCAG 2.1 Level AA guidelines. If you encounter accessibility barriers, please
                contact us at{" "}
                <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                  info@kneadmag.com
                </a>{" "}
                so we can address the issue.
              </p>
            </div>

            {/* Changes to Policy */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">11. Changes to This Policy</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated"
                date at the top of this page. Continued use of Knead after changes are posted constitutes your
                acceptance of the updated policy.
              </p>
            </div>

            {/* Contact */}
            <div className="border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">12. Contact Us</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-2">
                For privacy inquiries or to exercise your rights, contact us at:
              </p>
              <address className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed not-italic">
                <strong>Knead Publishing LLC</strong>
                <br />
                313 East Broad Street #72
                <br />
                Richmond, VA 23219
                <br />
                <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                  info@kneadmag.com
                </a>
              </address>
              <p className="font-georgia-pro text-sm text-gray-500 mt-8 italic">
                Note: These documents are provided for informational purposes and should be reviewed by legal counsel
                before being relied upon.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
