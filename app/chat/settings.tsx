"use client";
import { useActiveAccount } from "thirdweb/react";

export default function SettingsPage() {
  const account = useActiveAccount();
  if (!account)
    return <div>Please sign in to access settings.</div>;

  return (
    <div>
      <h1 style={{ fontFamily: "Adonis, serif" }}>
        Settings
      </h1>
      {/* Add notification, accessibility, DM toggle, etc. */}
      <div>Coming soon...</div>
    </div>
  );
}
