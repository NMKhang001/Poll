"use client";

import { useWallet } from "@/app/wallet-context";
import { BalanceCard } from "./balance-card";
import { CreatePollForm } from "./create-poll-form";
import { EventFeed } from "./event-feed";

export function Sidebar() {
  const { address, connect } = useWallet();

  return (
    <div className="space-y-5">
      {address ? (
        <>
          <BalanceCard />
          <CreatePollForm />
        </>
      ) : (
        <ConnectCta onConnect={connect} />
      )}
      <EventFeed />
    </div>
  );
}

function ConnectCta({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="glass-strong p-6">
      <div className="text-[10px] uppercase tracking-[0.18em] text-accent-bright/80">
        Get Started
      </div>
      <h2 className="mt-2 text-lg font-semibold leading-tight">
        Connect a Stellar wallet to vote
      </h2>
      <p className="mt-2 text-sm text-muted">
        Browsing is free. Casting a stake-weighted ballot signs one Soroban
        call on Testnet, locking your XLM stake until the poll auto-releases.
      </p>
      <button
        onClick={onConnect}
        className="btn-primary mt-4 w-full px-4 py-2.5 text-sm font-medium"
      >
        Connect Wallet
      </button>
    </div>
  );
}
