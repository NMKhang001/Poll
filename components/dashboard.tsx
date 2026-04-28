"use client";

import { useWallet } from "@/app/wallet-context";
import { BalanceCard } from "./balance-card";
import { CreatePollForm } from "./create-poll-form";
import { PollList } from "./poll-list";
import { EventFeed } from "./event-feed";

export function Dashboard() {
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

      <PollList />

      <EventFeed />
    </div>
  );
}

function ConnectCta({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="glass p-6 text-center">
      <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
        Get Started
      </div>
      <h2 className="mt-2 text-xl font-semibold">
        Connect a Stellar wallet to vote
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Browsing is free. Casting a stake-weighted ballot signs one Soroban call
        on Testnet, locking your XLM stake until the poll auto-releases.
      </p>
      <button
        onClick={onConnect}
        className="btn-primary mt-4 px-4 py-2 text-sm font-medium"
      >
        Connect Wallet
      </button>
    </div>
  );
}
