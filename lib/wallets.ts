import { inAppWallet, createWallet } from "thirdweb/wallets";

/**
 * Single source of truth for the wallets the app supports.
 *
 * Used by BOTH the interactive <ConnectButton> on the sign-in screen and the
 * root-level <AutoConnect> in app/providers.tsx. Keeping one list ensures a
 * silent reconnect targets the exact wallet the user originally connected
 * (e.g. the MetaMask extension), instead of dropping them back to sign-in.
 */
export const kneadInAppWallet = inAppWallet({
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
});

export const wallets = [
  kneadInAppWallet,
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];
