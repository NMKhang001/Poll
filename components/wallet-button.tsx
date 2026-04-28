"use client";

import { useWallet } from "@/app/wallet-context";

function shorten(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        title="Click to disconnect"
        className="btn-ghost shrink-0 px-3 py-2 text-xs"
      >
        <span className="font-mono">{shorten(address)}</span>
        <span className="hidden text-subtle sm:inline"> · Disconnect</span>
      </button>
    );
  }

  return (
    <button onClick={connect} className="btn-primary shrink-0 px-3.5 py-2 text-xs font-medium">
      Connect Wallet
    </button>
  );
}
