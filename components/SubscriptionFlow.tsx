"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import StripeSubscription from "./StripeSubscription"; // <-- Make sure this import is correct

interface SubscriptionFlowProps {
  onSuccess?: () => void;
}

export default function SubscriptionFlow({
  onSuccess,
}: SubscriptionFlowProps) {
  const account = useActiveAccount();
  const [email, setEmail] = useState(account?.email || "");
  const [step, setStep] = useState(
    email ? "payment" : "email",
  );

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setStep("payment");
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="font-adonis text-2xl text-gray-900">
          Subscribe to Knead Magazine
        </CardTitle>
        <CardDescription className="font-georgia-pro text-gray-600">
          {step === "email"
            ? "Enter your email to get started"
            : "Complete your subscription"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "email" ? (
          <form
            onSubmit={handleEmailSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-georgia-pro text-sm font-medium text-gray-700"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 font-georgia-pro"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full font-georgia-pro"
            >
              Continue to Payment
            </Button>
          </form>
        ) : (
          <StripeSubscription
            email={email}
            user_address={account?.address}
            onSuccess={onSuccess}
          />
        )}
      </CardContent>
    </Card>
  );
}
