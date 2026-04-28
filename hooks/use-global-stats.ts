"use client";

import { useQuery } from "@tanstack/react-query";
import { readContract } from "@/lib/soroban";
import { getRecentEvents } from "@/lib/events";

export type GlobalStats = {
  pollCount: number;
  totalVotes: number;
  totalStakeStroops: bigint;
  uniqueVoters: number;
};

const MAIN = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;

export function useGlobalStats() {
  return useQuery<GlobalStats>({
    queryKey: ["global-stats", MAIN],
    queryFn: async () => {
      if (!MAIN) throw new Error("main contract id not configured");

      const [count, events] = await Promise.all([
        readContract<number>({
          contractId: MAIN,
          method: "poll_count",
          args: [],
        }).catch(() => 0),
        getRecentEvents(MAIN).catch(() => []),
      ]);

      const votes = events.filter((e) => e.kind === "vote");
      const totalStakeStroops = votes.reduce(
        (acc, e) => (e.kind === "vote" ? acc + e.stake : acc),
        0n
      );
      const uniqueVoters = new Set(
        votes.flatMap((e) => (e.kind === "vote" ? [e.voter] : []))
      ).size;

      return {
        pollCount: Number(count),
        totalVotes: votes.length,
        totalStakeStroops,
        uniqueVoters,
      };
    },
    enabled: !!MAIN,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}
