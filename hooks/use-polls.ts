"use client";

import { useQuery } from "@tanstack/react-query";
import { addrArg, readContract, u32Arg } from "@/lib/soroban";

export type Poll = {
  id: number;
  creator: string;
  question: string;
  num_options: number;
  deadline: bigint;
  finalized: boolean;
  winner: number;
  total_voters: number;
};

export type Tally = {
  weight_sum: bigint;
  stake_sum: bigint;
  voter_count: number;
};

export type Vote = {
  option_idx: number;
  stake: bigint;
  weight: bigint;
  released: boolean;
};

export type PollWithTallies = {
  poll: Poll;
  tallies: Tally[];
};

const MAIN = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;

export function usePollCount() {
  return useQuery({
    queryKey: ["poll-count", MAIN],
    queryFn: async () => {
      if (!MAIN) throw new Error("main contract id not configured");
      const n = await readContract<number>({
        contractId: MAIN,
        method: "poll_count",
        args: [],
      });
      return Number(n);
    },
    enabled: !!MAIN,
    staleTime: 30_000,
    refetchInterval: 12_000,
  });
}

export function usePolls() {
  const { data: count } = usePollCount();

  return useQuery({
    queryKey: ["polls", MAIN, count],
    queryFn: async (): Promise<PollWithTallies[]> => {
      if (!MAIN) throw new Error("main contract id not configured");
      if (!count) return [];

      const ids = Array.from({ length: count }, (_, i) => i + 1);
      const polls = await Promise.all(
        ids.map((id) =>
          readContract<Poll | null>({
            contractId: MAIN,
            method: "get_poll",
            args: [u32Arg(id)],
          }).catch(() => null)
        )
      );

      const out: PollWithTallies[] = [];
      for (const p of polls) {
        if (!p) continue;
        const tallyCalls = Array.from({ length: p.num_options }, (_, i) =>
          readContract<Tally>({
            contractId: MAIN,
            method: "get_tally",
            args: [u32Arg(p.id), u32Arg(i)],
          }).catch(() => ({
            weight_sum: 0n,
            stake_sum: 0n,
            voter_count: 0,
          }))
        );
        const tallies = await Promise.all(tallyCalls);
        out.push({ poll: p, tallies });
      }
      return out.sort((a, b) => b.poll.id - a.poll.id);
    },
    enabled: !!MAIN && (count ?? 0) > 0,
    staleTime: 15_000,
    refetchInterval: 12_000,
  });
}

export function useMyVote(pollId: number | null, address: string | null) {
  return useQuery({
    queryKey: ["my-vote", MAIN, pollId, address],
    queryFn: async (): Promise<Vote | null> => {
      if (!MAIN || pollId == null || !address) return null;
      const v = await readContract<Vote | null>({
        contractId: MAIN,
        method: "get_vote",
        args: [u32Arg(pollId), addrArg(address)],
      }).catch(() => null);
      return v ?? null;
    },
    enabled: !!MAIN && pollId != null && !!address,
    staleTime: 10_000,
  });
}
