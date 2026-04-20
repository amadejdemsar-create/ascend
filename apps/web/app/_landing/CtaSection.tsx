import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">
          Your Goals Are{" "}
          <span className="landing-gradient-text">Waiting</span>
        </h2>
        <p className="mt-4 text-lg text-zinc-400">
          Start with one yearly goal. Everything flows from there.
        </p>

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="landing-shimmer group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-lg font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-violet-500/25"
          >
            Open Ascend
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
