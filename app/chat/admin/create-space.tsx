import { useCreateSpace } from "@towns-protocol/react-sdk";
import { useState } from "react";
import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import styled from "styled-components";
import { ThirdwebConnectButton } from "@/components/ThirdwebConnectButton";

export default function CreateSpacePage() {
  const { createSpace, isPending } = useCreateSpace();
  const [spaceName, setSpaceName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const { address } = useAccount();
  const { data: signer } = useSigner();

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!signer)
      return alert("Connect your wallet as admin.");
    const { spaceId } = await createSpace(
      { spaceName },
      signer,
    );
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
