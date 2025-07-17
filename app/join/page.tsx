import { Header } from "@/components/header"
import { ExternalLink } from "lucide-react"

export default function JoinPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float">Become a member</h1>

          <div className="prose max-w-none font-georgia-pro mb-12 cloud-float-delay-1">
            <p className="text-lg">
              Join The Breadwinner's Club to access exclusive stories, member events, and early access to our shop
              drops.
            </p>
          </div>

          <div className="flex justify-center mb-12 cloud-float-delay-2">
            {/* The Breadwinner's Club - Only Option */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full">
              <h3 className="font-adonis text-2xl mb-4">The Breadwinner's Club</h3>
              <p className="text-4xl font-adonis mb-4">
                0.0042 ETH<span className="text-base font-adonis text-gray-600">/year</span>
              </p>
              <p className="font-georgia-pro mb-4">
                The Breadwinner's Club is our exclusive group chat hosted on Towns. Its benefits include:
              </p>
              <ul className="space-y-2 mb-6 font-georgia-pro">
                <li>• A 2025 Knead Annual Membership, accessing all our exclusive stories</li>
                <li>• Access to real-time interviews and AMAs</li>
                <li>• Priority access to our shop, events, and other perks</li>
              </ul>
              <p className="text-sm italic mb-8 font-georgia-pro">
                The Breadwinner's Club is issued in small batches, currently capped at 1,000 members.
              </p>
              <a
                href="https://app.towns.com/t/0x0e70ab324e8761e97f131eecc4dd63dfde33cb72/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
              >
                Join The Breadwinner's Club
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 pt-8 border-t border-gray-100 cloud-float-delay-3">
            <h3 className="font-adonis text-xl italic mb-4 cloud-float-delay-4">
              What if I already signed up for a 2025 Annual or Shift Meal membership?
            </h3>
            <p className="mb-8 font-georgia-pro">
              Those memberships are already included in our paywall. Connect your wallet to verify.
            </p>

            <h3 className="font-adonis text-xl italic mb-4">How do I use my Breadwinner's Club membership?</h3>
            <p className="mb-4 font-georgia-pro">
              You need to transfer the NFT into a wallet compatible with ThirdWeb (I.E., MetaMask, Rainbow Wallet,
              etc).
            </p>

            <h3 className="font-adonis text-xl italic mb-4">My membership isn't working.</h3>
            <p className="mb-8 font-georgia-pro">
              Email us at{" "}
              <a href="mailto:info@kneadmag.com" className="text-blue-600 hover:underline">
                info@kneadmag.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
