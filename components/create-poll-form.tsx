"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/app/wallet-context";
import { useCreatePoll } from "@/hooks/use-create-poll";
import { toError, UserRejectedError } from "@/lib/errors";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

const WINDOWS: { label: string; secs: number }[] = [
  { label: "5 min", secs: 5 * 60 },
  { label: "1 hr", secs: 60 * 60 },
  { label: "1 day", secs: 24 * 60 * 60 },
];

export function CreatePollForm() {
  const { address } = useWallet();
  const qc = useQueryClient();
  const create = useCreatePoll(address);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [numOptions, setNumOptions] = useState(3);
  const [windowSecs, setWindowSecs] = useState(WINDOWS[0].secs);

  if (!address) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ question, numOptions, windowSecs });
      qc.invalidateQueries({ queryKey: ["poll-count"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setQuestion("");
      setOpen(false);
    } catch {
      // surfaced via create.error below
    }
  }

  const err = create.error ? toError(create.error) : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost w-full px-4 py-2.5 text-sm font-medium"
      >
        + Start a New Poll
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
          New Poll
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-subtle hover:text-fg"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        placeholder="What should we vote on?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
        maxLength={200}
        className="glass-input w-full px-3 py-2 text-sm"
      />

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-subtle">
          Options
        </div>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumOptions(n)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                numOptions === n
                  ? "border-accent/60 bg-accent/20 text-accent-bright"
                  : "border-border bg-white/5 text-muted hover:border-border-strong"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-subtle">
          Voting Window
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWindowSecs(w.secs)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                windowSecs === w.secs
                  ? "border-accent/60 bg-accent/20 text-accent-bright"
                  : "border-border bg-white/5 text-muted hover:border-border-strong"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted">
        Voters get options 1 through {numOptions}. Vote weight equals the square
        root of the staked stroops, so big stakes contribute less per XLM.
      </div>

      <button
        type="submit"
        disabled={create.isPending || !question.trim()}
        className="btn-primary w-full px-4 py-2 text-sm font-medium"
      >
        {create.isPending ? "Submitting..." : "Create Poll"}
      </button>

      {create.isSuccess && create.data && (
        <a
          href={`${EXPLORER}/${create.data.hash}`}
          target="_blank"
          rel="noreferrer"
          className="block break-all rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success hover:bg-success/15"
        >
          Poll created: {create.data.hash.slice(0, 16)}...
        </a>
      )}

      {err && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          {err instanceof UserRejectedError
            ? "You rejected the request in your wallet."
            : `Failed: ${err.message}`}
        </div>
      )}
    </form>
  );
}
