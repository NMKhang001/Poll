"use client";

import { useGlobalStats } from "@/hooks/use-global-stats";

const MAIN_CONTRACT_ID = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;

function fmt(n?: number | bigint): string {
  if (n === undefined) return "—";
  return Number(n).toLocaleString("en-US");
}

function fmtXlm(stroops?: bigint): string {
  if (stroops === undefined) return "—";
  return (Number(stroops) / 1e7).toFixed(2);
}

export function Hero() {
  const { data, isLoading } = useGlobalStats();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-accent/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-[-8%] h-80 w-80 rounded-full bg-pink-500/20 blur-3xl"
      />

      <div className="relative pt-12 sm:pt-16">
        <div className="text-[10px] uppercase tracking-[0.22em] text-accent-bright/80">
          Stellar Testnet · Soroban
        </div>
        <h1 className="mt-3 max-w-3xl font-sans text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl sm:leading-[1.05]">
          On-chain polls priced by{" "}
          <span className="bg-gradient-to-r from-accent-bright to-pink-300 bg-clip-text text-transparent">
            quadratic voice
          </span>
          , not raw stake.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          A small group of small voters can outweigh one whale. Stake locks on
          chain through the native Stellar Asset Contract and auto-releases the
          moment the poll finalizes.
        </p>

        <div className="mt-7 flex flex-wrap items-stretch gap-3">
          <Chip label="Polls" value={fmt(data?.pollCount)} loading={isLoading} />
          <Chip
            label="Stake Locked"
            value={fmtXlm(data?.totalStakeStroops)}
            unit="XLM"
            loading={isLoading}
          />
          <Chip
            label="Voters"
            value={fmt(data?.uniqueVoters)}
            loading={isLoading}
          />
          <Chip
            label="Contract"
            value={
              MAIN_CONTRACT_ID
                ? `${MAIN_CONTRACT_ID.slice(0, 4)}…${MAIN_CONTRACT_ID.slice(-4)}`
                : "—"
            }
            href={
              MAIN_CONTRACT_ID
                ? `https://stellar.expert/explorer/testnet/contract/${MAIN_CONTRACT_ID}`
                : undefined
            }
            mono
          />
        </div>
      </div>
    </section>
  );
}

function Chip({
  label,
  value,
  unit,
  loading,
  href,
  mono,
}: {
  label: string;
  value: string;
  unit?: string;
  loading?: boolean;
  href?: string;
  mono?: boolean;
}) {
  const inner = (
    <div className="glass flex items-baseline gap-2 px-4 py-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-subtle">
        {label}
      </span>
      <span
        className={`font-semibold ${mono ? "font-mono text-sm" : "font-mono text-base"}`}
      >
        {loading ? (
          <span className="inline-block h-4 w-10 animate-pulse rounded bg-white/10" />
        ) : (
          <>
            {value}
            {unit && (
              <span className="ml-1 text-[10px] font-normal text-muted">
                {unit}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="transition-opacity hover:opacity-90"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
