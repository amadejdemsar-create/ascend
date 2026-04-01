import Link from "next/link";

export function LandingNav() {
  return (
    <nav className="landing-glass-nav fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-xl font-semibold tracking-tight text-white"
        >
          Ascend
        </Link>

        <div className="hidden items-center gap-8 sm:flex">
          <a
            href="#features"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            How It Works
          </a>
        </div>

        <Link
          href="/dashboard"
          className="landing-shimmer rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/20"
        >
          Open App
        </Link>
      </div>
    </nav>
  );
}
