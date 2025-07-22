"use client";
import {
  useConnect,
  useActiveWallet,
  useDisconnect,
} from "thirdweb/react";
import {
  inAppWallet,
  createWallet,
} from "thirdweb/wallets";
import { useState } from "react";

const socialProviders = [
  { key: "google", label: "Google" },
  { key: "apple", label: "Apple" },
  { key: "coinbase", label: "Coinbase" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
  { key: "farcaster", label: "Farcaster" },
  { key: "x", label: "X" },
];

export default function MembershipAuth() {
  const wallet = useActiveWallet();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Email sign-in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await connect(inAppWallet(), {
      auth: { options: ["email"] },
      email,
    });
    setLoading(false);
    setEmail("");
  };

  // Phone sign-in
  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await connect(inAppWallet(), {
      auth: { options: ["phone"] },
      phoneNumber: phone,
    });
    setLoading(false);
    setPhone("");
  };

  // Passkey sign-in
  const handlePasskeySignIn = async () => {
    setLoading(true);
    await connect(inAppWallet(), {
      auth: { options: ["passkey"] },
    });
    setLoading(false);
  };

  // Social sign-in
  const handleSocialSignIn = async (provider: string) => {
    setLoading(true);
    await connect(inAppWallet(), {
      auth: { options: [provider] },
    });
    setLoading(false);
  };

  // Connect a wallet (MetaMask, Coinbase, etc.)
  const handleWalletConnect = async (walletId: string) => {
    setLoading(true);
    await connect(createWallet(walletId));
    setLoading(false);
  };

  if (wallet) {
    return (
      <div
        style={{
          fontFamily: "georgia-pro, serif",
          padding: "2rem",
        }}
      >
        <style>{`@import url("https://use.typekit.net/gne1bgd.css");`}</style>
        <div style={{ marginBottom: "1.5rem" }}>
          <span
            style={{
              fontFamily: "adonis, serif",
              fontSize: "1.5rem",
            }}
          >
            Membership ID
          </span>
          <div
            style={{
              marginTop: "0.5rem",
              fontFamily: "georgia-pro, serif",
              fontSize: "1.1rem",
              wordBreak: "break-all",
              background: "#f5f5f5",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}
          >
            {wallet.address}
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#222",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.75rem 1.5rem",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "georgia-pro, serif",
        padding: "2rem",
      }}
    >
      <style>{`@import url("https://use.typekit.net/gne1bgd.css");`}</style>
      <div style={{ marginBottom: "1.5rem" }}>
        <span
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.5rem",
          }}
        >
          Sign In to Knead
        </span>
      </div>
      <form
        onSubmit={handleEmailSignIn}
        style={{ marginBottom: "1rem" }}
      >
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            fontFamily: "georgia-pro, serif",
            fontSize: "1.1rem",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            marginRight: "0.5rem",
            width: "220px",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#222",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
          }}
        >
          Sign In with Email
        </button>
      </form>
      <form
        onSubmit={handlePhoneSignIn}
        style={{ marginBottom: "1rem" }}
      >
        <input
          type="tel"
          required
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            fontFamily: "georgia-pro, serif",
            fontSize: "1.1rem",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            marginRight: "0.5rem",
            width: "220px",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#222",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
          }}
        >
          Sign In with Phone
        </button>
      </form>
      <button
        onClick={handlePasskeySignIn}
        disabled={loading}
        style={{
          fontFamily: "adonis, serif",
          fontSize: "1.1rem",
          background: "#222",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1.2rem",
          cursor: "pointer",
          marginBottom: "1rem",
          width: "220px",
        }}
      >
        Sign In with Passkey
      </button>
      <div
        style={{
          margin: "1.5rem 0 0.5rem 0",
          fontWeight: 600,
        }}
      >
        Or sign in with:
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {socialProviders.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSocialSignIn(key)}
            disabled={loading}
            style={{
              fontFamily: "adonis, serif",
              fontSize: "1.1rem",
              background: "#fff",
              color: "#222",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "0.5rem 1.2rem",
              cursor: "pointer",
              minWidth: "120px",
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div
        style={{
          margin: "1.5rem 0 0.5rem 0",
          fontWeight: 600,
        }}
      >
        Or connect a wallet:
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => handleWalletConnect("io.metamask")}
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#fff",
            color: "#222",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
            minWidth: "120px",
          }}
          type="button"
        >
          MetaMask
        </button>
        <button
          onClick={() =>
            handleWalletConnect("com.coinbase.wallet")
          }
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#fff",
            color: "#222",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
            minWidth: "120px",
          }}
          type="button"
        >
          Coinbase Wallet
        </button>
        <button
          onClick={() => handleWalletConnect("me.rainbow")}
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#fff",
            color: "#222",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
            minWidth: "120px",
          }}
          type="button"
        >
          Rainbow
        </button>
        <button
          onClick={() => handleWalletConnect("io.rabby")}
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#fff",
            color: "#222",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
            minWidth: "120px",
          }}
          type="button"
        >
          Rabby
        </button>
        <button
          onClick={() =>
            handleWalletConnect("io.zerion.wallet")
          }
          disabled={loading}
          style={{
            fontFamily: "adonis, serif",
            fontSize: "1.1rem",
            background: "#fff",
            color: "#222",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "0.5rem 1.2rem",
            cursor: "pointer",
            minWidth: "120px",
          }}
          type="button"
        >
          Zerion
        </button>
      </div>
    </div>
  );
}
