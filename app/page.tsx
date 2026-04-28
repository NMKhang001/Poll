import { WalletButton } from "@/components/wallet-button";
import { Hero } from "@/components/hero-section";
import { PollList } from "@/components/poll-list";
import { Sidebar } from "@/components/dashboard";

export default function Home() {
  return (
    <main className="min-h-screen pb-16">
      <Topbar />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Hero />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <section className="lg:col-span-8">
            <PollList />
          </section>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <Sidebar />
            </div>
          </aside>
        </div>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-subtle">
          Stellar Testnet · quadratic voting · stake auto-release
        </footer>
      </div>
    </main>
  );
}

function Topbar() {
  return (
    <div className="sticky top-0 z-30 mb-2 border-b border-white/10 bg-[rgb(30_27_75/0.55)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            Stake Belt
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-subtle sm:inline">
            · Quadratic Polls
          </span>
        </div>
        <WalletButton />
      </div>
    </div>
  );
}
