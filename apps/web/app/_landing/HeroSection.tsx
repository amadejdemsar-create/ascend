import Link from "next/link";
import { ArrowRight, Layers, Eye, Keyboard } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
      {/* Eyebrow */}
      <div className="landing-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5">
        <span className="text-sm font-medium text-violet-300">
          Personal goal tracking
        </span>
      </div>

      {/* Heading */}
      <h1 className="landing-fade-in landing-fade-in-delay-1 mx-auto max-w-4xl font-serif text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
        Connect{" "}
        <span className="landing-gradient-text">Daily Actions</span>
        {" "}to{" "}
        <span className="landing-gradient-text">Yearly Ambitions</span>
      </h1>

      {/* Subheading */}
      <p className="landing-fade-in landing-fade-in-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
        A 4-level goal hierarchy that breaks your biggest ambitions into focused
        weekly actions. Track progress, build streaks, and see your goals come
        together.
      </p>

      {/* CTA */}
      <div className="landing-fade-in landing-fade-in-delay-3 mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/dashboard"
          className="landing-shimmer group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-violet-500/25"
        >
          Open Ascend
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Proof stats */}
      <div className="landing-fade-in landing-fade-in-delay-4 mt-16 flex flex-wrap justify-center gap-6 sm:gap-12">
        <div className="landing-pulse-glow flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-6 py-3">
          <Layers className="size-5 text-violet-400" />
          <div className="text-left">
            <p className="text-lg font-bold text-white">4 Levels</p>
            <p className="text-xs text-zinc-500">Goal hierarchy</p>
          </div>
        </div>
        <div className="landing-pulse-glow flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-6 py-3">
          <Eye className="size-5 text-indigo-400" />
          <div className="text-left">
            <p className="text-lg font-bold text-white">5 Views</p>
            <p className="text-xs text-zinc-500">See goals your way</p>
          </div>
        </div>
        <div className="landing-pulse-glow flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-6 py-3">
          <Keyboard className="size-5 text-violet-400" />
          <div className="text-left">
            <p className="text-lg font-bold text-white">Keyboard-first</p>
            <p className="text-xs text-zinc-500">Full shortcut support</p>
          </div>
        </div>
      </div>
    </section>
  );
}
