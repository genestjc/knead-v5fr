"use client";
import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import styled from "styled-components";
import { ThirdwebConnectButton } from "@/components/thirdweb-connect-button";

// Membership contract details
const MEMBERSHIP_CONTRACT =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_ID = 0n;
const PREMIUM_ID = 1n;

const AdonisHeading = styled.h1`
  font-family: "Adonis", serif;
  font-size: 2rem;
  text-align: center;
  margin-bottom: 1rem;
`;

const BodyText = styled.p`
  font-family: "Georgia Pro", serif;
  font-size: 1.1rem;
  text-align: center;
`;

const Popup = styled.div`
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 2rem 1.5rem;
  max-width: 420px;
  margin: 2rem auto;
  z-index: 10;
  position: relative;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.12);
  z-index: 9;
`;

export default function ChatPage() {
  const account = useActiveAccount();
  const [membership, setMembership] = useState<
    "none" | "freemium" | "premium" | null
  >(null);
  const [showPopup, setShowPopup] = useState(true);

  // Check membership on connect
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
      // Check balances for both IDs
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

  // UI
  if (!account) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <AdonisHeading>
          Please sign in to access the chat
        </AdonisHeading>
        <ThirdwebConnectButton />
      </div>
    );
  }

  return (
    <div>
      {showPopup && (
        <>
          <Overlay onClick={() => setShowPopup(false)} />
          <Popup>
            {membership === "freemium" && (
              <>
                <AdonisHeading>Welcome</AdonisHeading>
                <BodyText>
                  Free members can watch the chat for{" "}
                  <b>2 hours per month</b>.
                </BodyText>
              </>
            )}
            {membership === "premium" && (
              <>
                <AdonisHeading>Welcome</AdonisHeading>
                <BodyText>
                  Members have <b>unlimited access</b> to
                  reading the chat.
                  <br />
                  <br />
                  <b>
                    Here's how you can earn a contributor
                    spot:
                  </b>
                  <ul
                    style={{
                      textAlign: "left",
                      fontFamily: "Georgia Pro, serif",
                      margin: "1rem 0 0 1.5rem",
                    }}
                  >
                    <li>
                      Earn 1,000 $TOWNS by receiving likes
                      on your comments during open periods.
                    </li>
                    <li>
                      Contributors can talk in any chat, DM
                      others, and set an alias/bio (admin
                      approved).
                    </li>
                    <li>
                      Admins can also assign contributor
                      status manually.
                    </li>
                  </ul>
                </BodyText>
              </>
            )}
            {membership === "none" && (
              <>
                <AdonisHeading>Access Denied</AdonisHeading>
                <BodyText>
                  You do not have a Knead membership NFT.
                  <br />
                  Please acquire one to access the chat.
                </BodyText>
              </>
            )}
          </Popup>
        </>
      )}
      {/* Place Towns chat UI here after gating */}
      <div style={{ marginTop: "2rem" }}>
        {/* <TownsChatComponent ... /> */}
      </div>
    </div>
  );
}
