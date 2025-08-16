"use client";
import { useCreateSpace } from "@towns-protocol/react-sdk";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";

export default function CreateSpacePage() {
  const { createSpace, isPending } = useCreateSpace();
  const [spaceName, setSpaceName] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const account = useActiveAccount();

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!account) return alert("Connect your wallet as admin.");
    // You need to provide a signer (see Towns docs for details)
    const signer = ...; // get your signer here
    const { spaceId } = await createSpace({ spaceName }, signer);
    setSpaceId(spaceId);
    // Save this spaceId somewhere safe!
  };

  return (
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
      {spaceId && <div>Created spaceId: {spaceId}</div>}
    </form>
  );
}
