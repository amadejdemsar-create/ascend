import { Star, Target, Calendar, CheckSquare } from "lucide-react";

const levels = [
  {
    number: 1,
    title: "Yearly Goals",
    description:
      "Set your north star. Where do you want to be in a year?",
    icon: Star,
    dotClass: "landing-level-dot-1",
  },
  {
    number: 2,
    title: "Quarterly Milestones",
    description:
      "Break the year into 90-day sprints with clear targets.",
    icon: Target,
    dotClass: "landing-level-dot-2",
  },
  {
    number: 3,
    title: "Monthly Objectives",
    description:
      "Focus each month on what moves the needle.",
    icon: Calendar,
    dotClass: "landing-level-dot-3",
  },
  {
    number: 4,
    title: "Weekly Actions",
    description:
      "The smallest unit. Complete these, and everything above follows.",
    icon: CheckSquare,
    dotClass: "landing-level-dot-4",
  },
];

export function HierarchySection() {
  return (
    <section id="how-it-works" className="relative px-6 py-24">
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">
            From <span className="landing-gradient-text">Vision</span> to{" "}
            <span className="landing-gradient-text">Action</span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Four levels connect your ambitions to the work you do each week.
          </p>
        </div>

        {/* Cascade */}
        <div className="relative mx-auto max-w-2xl">
          {levels.map((level, idx) => (
            <div
              key={level.number}
              className={`relative flex items-start gap-5 ${
                idx < levels.length - 1 ? "landing-cascade-line pb-10" : ""
              }`}
              style={{ paddingLeft: `${idx * 24}px` }}
            >
              {/* Level indicator */}
              <div className={`landing-level-dot ${level.dotClass}`}>
                <level.icon className="size-5" />
              </div>

              {/* Content */}
              <div className="pt-1">
                <h3 className="text-lg font-semibold text-white">
                  {level.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {level.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
