import type { Metadata } from "next"
import { Header } from "@/components/header"

export const metadata: Metadata = {
  title: "Terms of Service | Knead",
  description:
    "Knead Publishing LLC terms of service covering membership tiers, payment terms, NFT membership, chat moderation, and governing law.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-adonis text-4xl md:text-5xl mb-4">Terms of Service</h1>
            <p className="font-georgia-pro text-gray-500 text-sm mb-2">Last Updated: March 10, 2026</p>
            <p className="font-georgia-pro text-gray-600 italic mb-12 leading-relaxed">
              These terms were last updated on March 10, 2026. We recommend reviewing them regularly. If you have
              questions, contact us at{" "}
              <a href="mailto:info@kneadmag.com" className="hover:text-black transition-colors">
                info@kneadmag.com
              </a>
              .
            </p>

            {/* 1. Acceptance */}
            <div className="mb-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">1. Acceptance of Terms</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                By accessing or using Knead ("the Service"), operated by Knead Publishing LLC, you agree to be bound
                by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These
                Terms apply to all visitors, subscribers, and contributors.
              </p>
            </div>

            {/* 2. Service Description */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">2. Service Description</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                Knead is a digital magazine platform covering art, music, food, technology, and other creative
                disciplines. Access to certain content and features is gated by membership tier, including
                NFT-based membership on the Base blockchain network.
              </p>
            </div>

            {/* 3. Membership Tiers */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">3. Membership Tiers</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-2">Freemium</h3>
                  <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    Free access to up to 3 articles per month and 1 hour of community chat viewing per session. No
                    payment required. Freemium usage is tracked via browser local storage.
                  </p>
                </div>
                <div>
                  <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-2">Knead Monthly</h3>
                  <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    $5/month subscription via Stripe. Provides unlimited access to all articles and full community chat
                    participation. Billed monthly, with automatic renewal until cancelled.
                  </p>
                </div>
                <div>
                  <h3 className="font-adonis text-xl md:text-2xl text-gray-600 mb-2">Contributor (NFT-Based)</h3>
                  <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    Holding a Knead Contributor NFT on the Base network grants elevated access and special permissions
                    within the community. NFT ownership is verified on-chain at login.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Payment Terms */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">4. Payment Terms</h2>
              <ul className="space-y-4 list-disc list-inside">
                {[
                  "Subscriptions are processed and managed by Stripe. By subscribing, you agree to Stripe's terms of service.",
                  "Subscriptions renew automatically at the end of each billing period unless cancelled.",
                  "You may cancel your subscription at any time. Access continues through the end of the current billing period.",
                  "We do not offer refunds for partial billing periods.",
                  "Prices are subject to change with reasonable notice. Continued use after a price change constitutes acceptance.",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 5. NFT Membership */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">5. NFT Membership</h2>
              <ul className="space-y-4 list-disc list-inside">
                {[
                  "Knead NFTs are minted on the Base network and represent membership access to the platform.",
                  "NFT ownership is the sole determinant of NFT-based permissions. Transferring your NFT transfers those permissions.",
                  "You are solely responsible for the security of your wallet and private keys. We cannot recover lost wallets.",
                  "Blockchain transactions are irreversible. Minting, transferring, or burning NFTs cannot be undone.",
                  "We make no representations about the monetary value of any NFT or token issued on the platform. Token awards are for community recognition only and have no guaranteed monetary value.",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 6. Chat Moderation & Banning */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">6. Chat Moderation & Banning</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4 font-semibold">
                We reserve the right to ban or remove any user from chat for any reason, at our sole discretion,
                without prior notice. We may refuse service to any user for any reason.
              </p>
              <ul className="space-y-4 list-disc list-inside">
                {[
                  "Banned users lose access to community chat but may retain article access based on their membership tier.",
                  "We reserve the right to revoke all platform access entirely for severe or repeated violations of these Terms.",
                  "Moderation decisions are final. Appeals may be submitted to info@kneadmag.com but are not guaranteed a response.",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 7. Content Ownership */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">7. Content Ownership</h2>
              <ul className="space-y-4 list-disc list-inside">
                {[
                  "Knead Publishing LLC owns all published articles, editorial content, and platform design.",
                  "You retain ownership of any original content you post in community chat.",
                  "By posting in community chat, you grant Knead a non-exclusive, royalty-free, worldwide license to display and distribute your content within the platform.",
                  "You represent that you have the right to post any content you share and that it does not violate any third-party rights.",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 8. Prohibited Conduct */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">8. Prohibited Conduct</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="space-y-3 list-disc list-inside">
                {[
                  "Harass, threaten, or demean other users",
                  "Post hate speech, discriminatory content, or content that incites violence",
                  "Spam the platform with unsolicited promotions or repetitive messages",
                  "Impersonate another person or entity",
                  "Share illegal content or content that violates third-party intellectual property rights",
                  "Attempt to circumvent paywalls, access restrictions, or membership verification systems",
                  "Interfere with or disrupt the platform's infrastructure or security",
                  "Use the platform to engage in any illegal activity",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 9. Disclaimers */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">9. Disclaimers</h2>
              <ul className="space-y-4 list-disc list-inside">
                {[
                  'The Service is provided "as is" and "as available" without warranties of any kind, express or implied.',
                  "We do not guarantee continuous, uninterrupted availability of the platform.",
                  "Blockchain transactions are irreversible. We are not responsible for losses arising from user error in blockchain interactions.",
                  "We are not responsible for the content of third-party services integrated with Knead (Stripe, ThirdWeb, Towns Protocol, etc.).",
                  "Token awards and community recognition features have no guaranteed monetary value.",
                ].map((item) => (
                  <li key={item} className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 10. Limitation of Liability */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">10. Limitation of Liability</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                To the fullest extent permitted by applicable law, Knead Publishing LLC, its officers, directors,
                employees, and agents shall not be liable for any indirect, incidental, special, consequential, or
                punitive damages arising from your use of the Service, even if we have been advised of the possibility
                of such damages. Our total liability to you for any claim arising from these Terms or your use of the
                Service shall not exceed the amount you paid to us in the 12 months preceding the claim.
              </p>
            </div>

            {/* 11. Governing Law */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">11. Governing Law</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of
                Virginia, without regard to its conflict of law provisions. Any disputes arising under these Terms
                shall be resolved in the state or federal courts located in Richmond, Virginia, and you consent to
                personal jurisdiction in those courts.
              </p>
            </div>

            {/* 12. Changes to Terms */}
            <div className="mb-12 border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">12. Changes to Terms</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. When we do, we will update the "Last Updated"
                date at the top of this page and, where appropriate, notify you by email. Continued use of the Service
                after changes are posted constitutes your acceptance of the updated Terms.
              </p>
            </div>

            {/* 13. Contact */}
            <div className="border-t border-gray-100 pt-12">
              <h2 className="font-adonis text-2xl md:text-3xl mb-6">13. Contact Us</h2>
              <p className="font-georgia-pro text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                For questions about these Terms, contact us at:
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
