"use client";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { ProfileForm } from "@/components/ProfileForm";

export default function ProfilePage() {
  const account = useActiveAccount();
  const [submitted, setSubmitted] = useState(false);

  if (!account)
    return <div>Please sign in to edit your profile.</div>;

  return (
    <div>
      <h1 style={{ fontFamily: "Adonis, serif" }}>
        Edit Profile
      </h1>
      {submitted ? (
        <div>
          Your profile update is pending admin approval.
        </div>
      ) : (
        <ProfileForm
          initial={{}}
          onSubmit={async (data) => {
            // Call your backend API to submit for approval
            await fetch("/api/profile/submit", {
              method: "POST",
              body: JSON.stringify({
                ...data,
                address: account.address,
              }),
              headers: {
                "Content-Type": "application/json",
              },
            });
            setSubmitted(true);
          }}
        />
      )}
    </div>
  );
}
