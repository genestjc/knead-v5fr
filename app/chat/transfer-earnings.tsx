"use client";
import { useActiveAccount } from "thirdweb/react";

export default function TransferEarningsPage() {
  const account = useActiveAccount();
  if (!account)
    return <div>Please sign in to transfer earnings.</div>;

  return (
    <div>
      <h1 style={{ fontFamily: "Adonis, serif" }}>
        Transfer Earnings
      </h1>
      {/* Integrate thirdweb embedded wallet transfer UI here */}
      <div>Coming soon...</div>
    </div>
  );
}
