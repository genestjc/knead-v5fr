"use client";
import { useCreateSpace } from "@towns-protocol/react-sdk";
import { useState } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";

export default function CreateSpacePage() {
  const { createSpace, isPending } = useCreateSpace();
  const [spaceName, setSpaceName] = useState("");
  const [spaceId, setSpaceId] = useState("");

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Get signer from your wallet provider (e.g., viem, wagmi, or thirdweb Embedded Wallet)
    // For demo, we'll skip signer logic
    const signer = undefined; // Replace with actual signer
    const { spaceId } = await createSpace(
      { spaceName },
      signer,
    );
    setSpaceId(spaceId);
    await fetch("/api/spaces/create", {
      method: "POST",
      body: JSON.stringify({ spaceName, spaceId }),
      headers: { "Content-Type": "application/json" },
    });
  };

  return (
    <div style={{ display: "flex" }}>
      <AdminSidebar />
      <main style={{ padding: 32, flex: 1 }}>
        <h1>Create New Space</h1>
        <form onSubmit={handleCreateSpace}>
          <input
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder="Space name"
            required
          />
          <button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Space"}
          </button>
        </form>
        {spaceId && (
          <div>
            Created spaceId: <b>{spaceId}</b>
          </div>
        )}
      </main>
    </div>
  );
}
