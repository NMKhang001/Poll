export function HeroSection() {
  return (
    <section className="mt-7">
      <p className="text-base leading-relaxed text-muted sm:text-lg">
        On-chain polls{" "}
        <span className="text-fg">priced by quadratic voice, not raw stake</span>
        , so a small group of small voters can outweigh one whale.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Step n={1} label="Pick a Poll" desc="Browse open questions" />
        <Step n={2} label="Lock Stake" desc="Weight = sqrt(stake)" />
        <Step n={3} label="Auto-Release" desc="Claim once finalized" />
      </div>
    </section>
  );
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div className="glass flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-accent/15 font-mono text-xs text-accent-bright">
        {n}
      </span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-subtle">{desc}</div>
      </div>
    </div>
  );
}
