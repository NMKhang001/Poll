"use client";

import { useMemo, useState } from "react";
import { usePolls } from "@/hooks/use-polls";
import { PollCard } from "./poll-card";

type Filter = "active" | "closed" | "all";

export function PollList() {
  const { data, isLoading, isError } = usePolls();
  const [filter, setFilter] = useState<Filter>("active");

  const now = useMemo(() => Math.floor(Date.now() / 1000), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    return data.filter(({ poll }) => {
      const closed = now >= Number(poll.deadline) || poll.finalized;
      return filter === "closed" ? closed : !closed;
    });
  }, [data, filter, now]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
          Polls
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-white/5 p-0.5">
          {(["active", "closed", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors ${
                filter === f
                  ? "bg-accent/30 text-accent-bright"
                  : "text-subtle hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : isError ? (
          <div className="glass p-5 text-sm text-danger">
            Failed to load polls. Soroban RPC may be rate-limited; try again in a
            moment.
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-5 text-sm text-muted">
            {filter === "active"
              ? "No active polls. Be the first to start one above."
              : filter === "closed"
                ? "No closed polls yet."
                : "No polls have been created yet."}
          </div>
        ) : (
          filtered.map((p) => <PollCard key={p.poll.id} data={p} />)
        )}
      </div>
    </section>
  );
}
