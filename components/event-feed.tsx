"use client";

import { useContractEvents } from "@/hooks/use-contract-events";
import type { ContractEvent } from "@/lib/events";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function shortAddr(a: string) {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

function fmtAmount(stroops: bigint) {
  const xlm = Number(stroops) / 1e7;
  return xlm.toFixed(4).replace(/\.?0+$/, "");
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function EventFeed() {
  const { data, isLoading, isError } = useContractEvents();

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-subtle">
        Live Activity
        <span className="ml-auto flex items-center gap-1.5 text-accent-bright">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent live-dot" />
          </span>
          Live
        </span>
      </div>
      {isLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-3 text-sm text-danger">Failed to load events</div>
      ) : !data || data.length === 0 ? (
        <div className="mt-3 text-sm text-subtle">
          No on-chain activity yet. Vote on a poll and it shows up here within a
          few seconds.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {data.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ e }: { e: ContractEvent }) {
  return (
    <li className="border-l-2 border-accent/40 pl-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <Headline e={e} />
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs text-subtle hover:text-accent-bright"
        >
          {timeAgo(e.ledgerClosedAt)}
        </a>
      </div>
      <Detail e={e} />
    </li>
  );
}

function Headline({ e }: { e: ContractEvent }) {
  if (e.kind === "vote") {
    return (
      <div>
        <span className="font-mono text-xs">{shortAddr(e.voter)}</span>
        <span className="text-subtle"> voted </span>
        <span className="font-medium text-accent-bright">
          {OPTION_LABELS[e.optionIdx] ?? e.optionIdx}
        </span>
        <span className="text-subtle"> on poll #{e.pollId}</span>
      </div>
    );
  }
  if (e.kind === "created") {
    return (
      <div>
        <span className="font-mono text-xs">{shortAddr(e.creator)}</span>
        <span className="text-subtle"> opened </span>
        <span className="font-medium">poll #{e.pollId}</span>
      </div>
    );
  }
  if (e.kind === "final") {
    return (
      <div>
        <span className="text-subtle">Poll #{e.pollId} </span>
        <span className="font-medium text-success">finalized</span>
        <span className="text-subtle"> · winner </span>
        <span className="font-medium text-accent-bright">
          {OPTION_LABELS[e.winner] ?? e.winner}
        </span>
      </div>
    );
  }
  return (
    <div>
      <span className="font-mono text-xs">{shortAddr(e.voter)}</span>
      <span className="text-subtle"> released stake on poll #{e.pollId}</span>
    </div>
  );
}

function Detail({ e }: { e: ContractEvent }) {
  if (e.kind === "vote") {
    return (
      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted">
        <span className="font-mono text-accent-bright">
          {fmtAmount(e.stake)} XLM
        </span>
        <span className="font-mono">
          weight {Number(e.weight).toLocaleString()}
        </span>
      </div>
    );
  }
  if (e.kind === "created") {
    const labels = e.options?.length
      ? e.options.join(" / ")
      : `${e.numOptions} options`;
    return (
      <div className="mt-1 truncate text-xs text-muted">
        &ldquo;{e.question}&rdquo; · {labels}
      </div>
    );
  }
  if (e.kind === "final") {
    return (
      <div className="mt-1 text-xs text-muted">
        Top quadratic weight {Number(e.topWeight).toLocaleString()}
      </div>
    );
  }
  return (
    <div className="mt-1 text-xs text-muted font-mono">
      {fmtAmount(e.stake)} XLM unlocked
    </div>
  );
}
