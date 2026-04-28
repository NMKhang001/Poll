"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/app/wallet-context";
import {
  useMyVote,
  type PollWithTallies,
  type Tally,
} from "@/hooks/use-polls";
import { useSendTx } from "@/hooks/use-send-tx";
import { useFinalize } from "@/hooks/use-finalize";
import { useReleaseStake } from "@/hooks/use-release-stake";
import { xlmToStroops } from "@/lib/soroban";
import {
  toError,
  UserRejectedError,
  InsufficientBalanceError,
} from "@/lib/errors";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function fmtStake(stroops: bigint) {
  return (Number(stroops) / 1e7).toFixed(4).replace(/\.?0+$/, "");
}

function isqrtNum(n: number): number {
  return Math.floor(Math.sqrt(Math.max(0, n)));
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatRemaining(deadline: number, now: number): string {
  const diff = deadline - now;
  if (diff <= 0) return "Closed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

export function PollCard({ data }: { data: PollWithTallies }) {
  const { address } = useWallet();
  const qc = useQueryClient();
  const { poll, tallies } = data;
  const now = useNow();
  const deadline = Number(poll.deadline);
  const closed = now >= deadline;

  const { data: myVote } = useMyVote(poll.id, address);
  const send = useSendTx(address);
  const finalize = useFinalize(address);
  const release = useReleaseStake(address);

  const [selected, setSelected] = useState<number>(0);
  const [stake, setStake] = useState("1");

  const totalWeight = tallies.reduce((acc, t) => acc + Number(t.weight_sum), 0);
  const totalStake = tallies.reduce((acc, t) => acc + Number(t.stake_sum), 0);

  const previewWeight = (() => {
    try {
      return Number(xlmToStroops(stake || "0"));
    } catch {
      return 0;
    }
  })();
  const previewSqrt = isqrtNum(previewWeight);

  async function onVote(e: FormEvent) {
    e.preventDefault();
    try {
      await send.mutateAsync({
        pollId: poll.id,
        optionIdx: selected,
        stake,
      });
      qc.invalidateQueries({ queryKey: ["polls"] });
      qc.invalidateQueries({ queryKey: ["my-vote", undefined, poll.id] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["balance", address] });
    } catch {
      // surfaced via send.error
    }
  }

  async function onFinalize() {
    try {
      await finalize.mutateAsync(poll.id);
      qc.invalidateQueries({ queryKey: ["polls"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch {
      // surfaced via finalize.error
    }
  }

  async function onRelease() {
    try {
      await release.mutateAsync(poll.id);
      qc.invalidateQueries({ queryKey: ["my-vote", undefined, poll.id] });
      qc.invalidateQueries({ queryKey: ["polls"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch {
      // surfaced via release.error
    }
  }

  const sendErr = send.error ? toError(send.error) : null;
  const finErr = finalize.error ? toError(finalize.error) : null;
  const relErr = release.error ? toError(release.error) : null;

  return (
    <article className="glass p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-subtle">
            <span>Poll #{poll.id}</span>
            <span>·</span>
            <span className="font-mono">
              {poll.creator.slice(0, 4)}...{poll.creator.slice(-4)}
            </span>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold leading-snug">
            {poll.question}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            poll.finalized
              ? "border-success/40 bg-success/10 text-success"
              : closed
                ? "border-border-strong bg-white/5 text-muted"
                : "border-accent/50 bg-accent/15 text-accent-bright"
          }`}
        >
          {poll.finalized
            ? "Finalized"
            : closed
              ? "Awaiting finalize"
              : formatRemaining(deadline, now)}
        </span>
      </header>

      <ul className="mt-4 space-y-3">
        {tallies.map((t, i) => (
          <OptionRow
            key={i}
            idx={i}
            tally={t}
            totalWeight={totalWeight}
            totalStake={totalStake}
            selected={selected === i && !myVote && !closed}
            isWinner={poll.finalized && poll.winner === i}
            isMyChoice={myVote?.option_idx === i}
            disabled={!!myVote || closed}
            onSelect={() => setSelected(i)}
          />
        ))}
      </ul>

      {!closed && address && !myVote && (
        <form onSubmit={onVote} className="mt-4 space-y-2.5">
          <div className="flex items-stretch gap-2">
            <input
              type="number"
              step="0.0000001"
              min="0.0000001"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              required
              className="glass-input w-32 px-3 py-2 font-mono text-sm"
              placeholder="Stake"
            />
            <button
              type="submit"
              disabled={send.isPending}
              className="btn-primary flex-1 px-3 py-2 text-sm font-medium"
            >
              {send.isPending
                ? "Submitting..."
                : `Stake ${stake || "0"} XLM on ${OPTION_LABELS[selected]}`}
            </button>
          </div>
          <div className="text-xs text-muted">
            Quadratic weight ≈ {previewSqrt.toLocaleString()} (sqrt of stroops)
          </div>
        </form>
      )}

      {!closed && !address && (
        <div className="mt-4 text-xs text-subtle">
          Connect your wallet to cast a stake-weighted vote.
        </div>
      )}

      {!closed && myVote && (
        <div className="mt-4 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-accent-bright">
          You staked {fmtStake(myVote.stake)} XLM on option{" "}
          {OPTION_LABELS[myVote.option_idx]} (weight{" "}
          {Number(myVote.weight).toLocaleString()}).
        </div>
      )}

      {closed && !poll.finalized && address && (
        <div className="mt-4">
          <button
            onClick={onFinalize}
            disabled={finalize.isPending}
            className="btn-primary w-full px-3 py-2 text-sm font-medium"
          >
            {finalize.isPending ? "Finalizing..." : "Finalize Poll"}
          </button>
        </div>
      )}

      {poll.finalized && myVote && !myVote.released && address && (
        <div className="mt-4">
          <button
            onClick={onRelease}
            disabled={release.isPending}
            className="btn-ghost w-full px-3 py-2 text-sm font-medium"
          >
            {release.isPending
              ? "Releasing..."
              : `Release ${fmtStake(myVote.stake)} XLM Stake`}
          </button>
        </div>
      )}

      {poll.finalized && myVote?.released && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
          Stake released. On-chain receipt is in the activity feed.
        </div>
      )}

      {send.isSuccess && send.data && (
        <a
          href={`${EXPLORER}/${send.data.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-all rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success hover:bg-success/15"
        >
          Vote recorded: {send.data.hash.slice(0, 16)}...
        </a>
      )}

      {finalize.isSuccess && finalize.data && (
        <a
          href={`${EXPLORER}/${finalize.data.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-all rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success hover:bg-success/15"
        >
          Finalized: {finalize.data.hash.slice(0, 16)}...
        </a>
      )}

      {release.isSuccess && release.data && (
        <a
          href={`${EXPLORER}/${release.data.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-all rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success hover:bg-success/15"
        >
          Released: {release.data.hash.slice(0, 16)}...
        </a>
      )}

      {sendErr && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          {sendErr instanceof UserRejectedError
            ? "You rejected the request in your wallet."
            : sendErr instanceof InsufficientBalanceError
              ? "Not enough XLM in your account."
              : `Failed: ${sendErr.message}`}
        </div>
      )}
      {finErr && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          {finErr instanceof UserRejectedError
            ? "You rejected the request in your wallet."
            : `Failed: ${finErr.message}`}
        </div>
      )}
      {relErr && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          {relErr instanceof UserRejectedError
            ? "You rejected the request in your wallet."
            : `Failed: ${relErr.message}`}
        </div>
      )}
    </article>
  );
}

function OptionRow({
  idx,
  tally,
  totalWeight,
  totalStake,
  selected,
  isWinner,
  isMyChoice,
  disabled,
  onSelect,
}: {
  idx: number;
  tally: Tally;
  totalWeight: number;
  totalStake: number;
  selected: boolean;
  isWinner: boolean;
  isMyChoice: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const w = Number(tally.weight_sum);
  const s = Number(tally.stake_sum);
  const weightPct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
  const stakePct = totalStake > 0 ? (s / totalStake) * 100 : 0;

  const baseRing = selected
    ? "border-accent/70 bg-accent/15"
    : isWinner
      ? "border-success/45 bg-success/8"
      : isMyChoice
        ? "border-accent/40 bg-accent/8"
        : "border-border hover:border-border-strong";

  return (
    <li>
      <button
        type="button"
        onClick={disabled ? undefined : onSelect}
        disabled={disabled}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${baseRing} ${
          disabled ? "cursor-default" : "cursor-pointer"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/50 bg-accent/15 font-mono text-[11px] text-accent-bright">
              {OPTION_LABELS[idx]}
            </span>
            <span className="text-sm font-medium">
              Option {OPTION_LABELS[idx]}
            </span>
            {isWinner && (
              <span className="rounded-full border border-success/50 bg-success/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                Won
              </span>
            )}
            {isMyChoice && (
              <span className="rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-bright">
                Yours
              </span>
            )}
          </div>
          <div className="text-right text-xs">
            <div className="font-mono font-semibold text-fg">
              {weightPct.toFixed(1)}%
            </div>
            <div className="text-subtle">
              {tally.voter_count} voter{tally.voter_count === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="tally-track mt-2 h-2 w-full overflow-hidden rounded-full">
          <div
            className="tally-bar h-full rounded-full"
            style={{ width: `${weightPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-subtle">
          <span>weight {w.toLocaleString()}</span>
          <span>stake {(s / 1e7).toFixed(2)} XLM ({stakePct.toFixed(0)}%)</span>
        </div>
      </button>
    </li>
  );
}
