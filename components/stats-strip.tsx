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

export function StatsStrip() {
  const { data, isLoading } = useGlobalStats();

  return (
    <section className="mt-7">
      <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
        Global
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox
          label="Polls Created"
          value={fmt(data?.pollCount)}
          loading={isLoading}
        />
        <StatBox
          label="Stake Locked"
          value={fmtXlm(data?.totalStakeStroops)}
          unit="XLM"
          loading={isLoading}
        />
        <StatBox
          label="Unique Voters"
          value={fmt(data?.uniqueVoters)}
          loading={isLoading}
        />
        <StatBox
          label="Contract"
          value={
            MAIN_CONTRACT_ID
              ? `${MAIN_CONTRACT_ID.slice(0, 4)}...${MAIN_CONTRACT_ID.slice(-4)}`
              : "—"
          }
          href={
            MAIN_CONTRACT_ID
              ? `https://stellar.expert/explorer/testnet/contract/${MAIN_CONTRACT_ID}`
              : undefined
          }
          loading={false}
          mono
        />
      </div>
    </section>
  );
}

function StatBox({
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
  loading: boolean;
  href?: string;
  mono?: boolean;
}) {
  const content = (
    <div className="glass h-full px-3.5 py-3 transition-colors">
      <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-semibold ${
          mono ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        {loading ? (
          <span className="inline-block h-5 w-12 animate-pulse rounded bg-elevated" />
        ) : (
          <>
            {value}
            {unit && (
              <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl transition-colors hover:[&>div]:bg-white/10"
      >
        {content}
      </a>
    );
  }
  return content;
}
