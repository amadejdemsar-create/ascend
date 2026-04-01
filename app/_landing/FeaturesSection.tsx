import {
  LayoutDashboard,
  Trophy,
  Search,
  Keyboard,
  Repeat,
  Bot,
} from "lucide-react";

const features = [
  {
    title: "Smart Dashboard",
    description:
      "Weekly focus, progress overview, streaks, and upcoming deadlines in one view.",
    icon: LayoutDashboard,
    wide: true,
  },
  {
    title: "Gamification",
    description:
      "XP, levels, streaks, and celebrations that make progress feel rewarding.",
    icon: Trophy,
    wide: false,
  },
  {
    title: "Command Palette",
    description:
      "Cmd+K to search, navigate, and create goals instantly.",
    icon: Search,
    wide: false,
  },
  {
    title: "Keyboard Shortcuts",
    description:
      "Full keyboard navigation so you can manage goals without touching the mouse.",
    icon: Keyboard,
    wide: false,
  },
  {
    title: "Recurring Goals",
    description:
      "Set it once, then track weekly or monthly streaks automatically.",
    icon: Repeat,
    wide: true,
  },
  {
    title: "AI Integration (MCP)",
    description:
      "Connect Claude or any AI assistant via Model Context Protocol to manage your goals.",
    icon: Bot,
    wide: false,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">
            Everything You{" "}
            <span className="landing-gradient-text">Need</span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Built for focus, speed, and the satisfaction of checking things off.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`landing-gradient-border p-6 transition-transform hover:-translate-y-1 ${
                feature.wide ? "landing-bento-wide" : ""
              }`}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-violet-500/10">
                <feature.icon className="size-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
