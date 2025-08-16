"use client";
import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import styled from "styled-components";
import { ThirdwebConnectButton } from "@/components/ThirdwebConnectButton";
import { WelcomePopup } from "@/components/WelcomePopup";
import { useFreemiumTimer } from "@/components/FreemiumTimer";
import { TownsChat } from "@/components/TownsChat";

// Membership contract details
const MEMBERSHIP_CONTRACT =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_ID = 0n;
const PREMIUM_ID = 1n;

// Example: replace with your actual spaceId for "Main"
const MAIN_SPACE_ID = "0xYourMainSpaceId";

const Centered = styled.div`
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

export default function ChatPage() {
  const account = useActiveAccount();
  const [membership, setMembership] = useState<
    "none" | "freemium" | "premium" | null
  >(null);
  const [showPopup, setShowPopup] = useState(true);

  useEffect(() => {
    if (!account) {
      setMembership(null);
      return;
    }
    (async () => {
      const contract = getContract({
        address: MEMBERSHIP_CONTRACT,
        chain: base,
        clientId:
          process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
      });
      const [freemium, premium] = await Promise.all([
        readContract({
          contract,
          method: "balanceOf(address,uint256)",
          params: [account.address, FREEMIUM_ID],
        }),
        readContract({
          contract,
          method: "balanceOf(address,uint256)",
          params: [account.address, PREMIUM_ID],
        }),
      ]);
      if (BigInt(premium) > 0n) setMembership("premium");
      else if (BigInt(freemium) > 0n)
        setMembership("freemium");
      else setMembership("none");
    })();
  }, [account]);

  const { timeLeft, isOut, formatted } = useFreemiumTimer(
    membership === "freemium",
  );

  if (!account) {
    return (
      <Centered>
        <h1
          style={{
            fontFamily: "Adonis, serif",
            fontSize: "2rem",
          }}
        >
          Please sign in to access the chat
        </h1>
        <ThirdwebConnectButton />
      </Centered>
    );
  }

  if (membership === "none") {
    return (
      <>
        {showPopup && (
          <WelcomePopup
            membership={membership}
            onClose={() => setShowPopup(false)}
          />
        )}
        <Centered>
          <h1
            style={{
              fontFamily: "Adonis, serif",
              fontSize: "2rem",
            }}
          >
            Access Denied
          </h1>
        </Centered>
      </>
    );
  }

  if (membership === "freemium" && isOut) {
    return (
      <Centered>
        <h1
          style={{
            fontFamily: "Adonis, serif",
            fontSize: "2rem",
          }}
        >
          Time Limit Reached
        </h1>
        <p style={{ fontFamily: "Georgia Pro, serif" }}>
          You have used your 2 hours of free chat viewing
          for this month.
          <br />
          Upgrade to premium for unlimited access.
        </p>
      </Centered>
    );
  }

  return (
    <div>
      {showPopup && (
        <WelcomePopup
          membership={membership}
          onClose={() => setShowPopup(false)}
        />
      )}
      {membership === "freemium" && (
        <div
          style={{
            textAlign: "center",
            margin: "1rem 0",
            fontFamily: "Georgia Pro, serif",
          }}
        >
          Time left this month: <b>{formatted}</b>
        </div>
      )}
      <div style={{ marginTop: "2rem" }}>
        <TownsChat
          spaceId={MAIN_SPACE_ID}
          userAddress={account.address}
        />
      </div>
    </div>
  );
}
