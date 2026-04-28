import { WalletButton } from "@/components/wallet-button";
import { Dashboard } from "@/components/dashboard";
import { HeroSection } from "@/components/hero-section";
import { StatsStrip } from "@/components/stats-strip";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <header className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            Stake Belt
          </h1>
          <WalletButton />
        </header>

        <HeroSection />
        <StatsStrip />

        <div className="my-8 h-px bg-border" />

        <Dashboard />

        <footer className="mt-12 text-center text-xs text-subtle">
          Stellar Testnet · quadratic voting · stake auto-release
        </footer>
      </div>
    </main>
  );
}
