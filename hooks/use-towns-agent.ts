"use client";

import { useEffect, useRef } from "react";
import { useAgentConnection } from "@towns-protocol/react-sdk";
import { townsEnv } from "@towns-protocol/sdk";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
} from "thirdweb/react";

export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } =
    useAgentConnection();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();

  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();

  useEffect(() => {
    async function connectAgent() {
      if (!activeAccount || !activeWallet || !activeChain) return;

      const address = activeAccount.address;

      if (hasConnectedRef.current && previousAddressRef.current === address)
        return;
      if (isAgentConnecting) return;

      if (
        previousAddressRef.current &&
        previousAddressRef.current !== address
      ) {
        disconnect?.();
        hasConnectedRef.current = false;
      }

      try {
        // Get the signer from thirdweb wallet (works for MetaMask, WalletConnect, etc.)
        const signer = await activeWallet.getSigner();

        const townsConfig = townsEnv().makeTownsConfig("omega");
        await connect(signer, { townsConfig });

        hasConnectedRef.current = true;
        previousAddressRef.current = address;
      } catch (error: any) {
        hasConnectedRef.current = false;
        console.error("Failed to connect Towns agent:", error);
      }
    }

    connectAgent();

    return () => {
      if (!activeAccount && hasConnectedRef.current) {
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
      }
    };
  }, [
    activeAccount,
    activeWallet,
    activeChain,
    isAgentConnecting,
    connect,
    disconnect,
  ]);

  return { isAgentConnected, isAgentConnecting };
}
