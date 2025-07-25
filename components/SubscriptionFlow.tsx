import { useActiveAccount } from "thirdweb/react";
import { useState } from "react";
import StripeSubscription from "./StripeSubscription";

export default function SubscriptionFlow({ onSuccess }) {
  const { account } = useActiveAccount();
  const [email, setEmail] = useState(account?.email || "");
  const [step, setStep] = useState(email ? 2 : 1);

  if (step === 1) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email) setStep(2);
        }}
      >
        <label>
          Enter your email:
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button type="submit">Continue</button>
      </form>
    );
  }

  return (
    <StripeSubscription
      email={email}
      user_address={account?.address}
      onSuccess={onSuccess}
    />
  );
}
