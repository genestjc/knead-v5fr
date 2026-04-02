"use client";

import { useEffect, useState } from "react";
import { useConnect, useDisconnect, useActiveAccount } from "thirdweb/react";

// Create a hook for local storage
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

// Now create the persistent wallet hook
export function usePersistentWallet() {
  const [shouldConnect, setShouldConnect] = useLocalStorage("wallet-connected", false);
  const account = useActiveAccount();
  const { connect, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  // Reconnect on page load if previously connected
  useEffect(() => {
    if (shouldConnect && !account && connectStatus !== "connecting") {
      console.log("Attempting to reconnect wallet from previous session");
      connect();
    }
  }, [shouldConnect, account, connectStatus, connect]);

  // Update connection state when wallet connects or disconnects
  useEffect(() => {
    if (account) {
      setShouldConnect(true);
    }
  }, [account, setShouldConnect]);

  const handleDisconnect = () => {
    disconnect();
    setShouldConnect(false);
  };

  return {
    account,
    isConnected: !!account,
    isConnecting: connectStatus === "connecting",
    disconnect: handleDisconnect,
    connect,
  };
}
