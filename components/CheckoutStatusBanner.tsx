"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function CheckoutStatusBanner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (status === "success") {
      setMessage(
        "Thank you for subscribing! Your access will update shortly.",
      );
    } else if (status === "cancel") {
      setMessage(
        "Checkout was cancelled. You have not been charged.",
      );
    }
  }, [searchParams]);

  if (!message) return null;
  return (
    <div className="mb-4 p-4 bg-green-100 text-green-800 rounded text-center">
      {message}
    </div>
  );
}
