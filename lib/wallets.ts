import { inAppWallet, createWallet } from "thirdweb/wallets";

/**
 * Single source of truth for the wallets the app supports.
 *
 * Used by BOTH the interactive <ConnectButton> on the sign-in screens and the
 * root-level <AutoConnect> in app/providers.tsx. Keeping one list ensures a
 * silent reconnect targets the exact wallet the user originally connected
 * (e.g. the MetaMask extension), instead of dropping them back to sign-in.
 *
 * This is a factory (not a module-level constant) because the in-app wallet's
 * OAuth `redirectUrl` must capture the URL of the page the user is on when
 * they sign in. A module-level constant freezes the URL of whatever page first
 * loaded the app — so a reader who browsed from the homepage to a story and
 * signed in with Google there was bounced back to the homepage after the
 * OAuth round-trip instead of returning to the story.
 */
export function createKneadWallets() {
  return [
    inAppWallet({
      auth: {
        options: ["email", "google", "apple", "coinbase", "passkey", "phone", "discord", "telegram", "farcaster", "x"],
        mode: "redirect",
        redirectUrl: typeof window !== "undefined" ? window.location.href : undefined,
      },
      hidePrivateKeyExport: false,
      executionMode: {
        mode: "EIP7702",
        sponsorGas: true,
      },
    }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
    createWallet("me.rainbow"),
    createWallet("io.rabby"),
    createWallet("io.zerion.wallet"),
  ];
}

/**
 * Module-level list for the root <AutoConnect>, which only resumes existing
 * sessions and never initiates an OAuth redirect — the frozen redirectUrl is
 * harmless there. Interactive <ConnectButton> surfaces should call
 * createKneadWallets() at render time instead.
 */
export const wallets = createKneadWallets();
