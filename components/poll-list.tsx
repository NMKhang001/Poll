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
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent-bright/80">
            Open Polls
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
            Cast your weight
          </h2>
        </div>
        <div className="flex gap-1 self-end rounded-full border border-white/15 bg-white/5 p-0.5 backdrop-blur">
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

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isLoading ? (
          <>
            <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
          </>
        ) : isError ? (
          <div className="glass p-5 text-sm text-danger sm:col-span-2">
            Failed to load polls. Soroban RPC may be rate-limited; try again in a
            moment.
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-muted sm:col-span-2">
            {filter === "active"
              ? "No active polls right now. Use the panel on the right to start one."
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
