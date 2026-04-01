import {
  LayoutGrid,
  List,
  Columns3,
  GitBranch,
  GanttChart,
} from "lucide-react";

const views = [
  {
    name: "Cards",
    description:
      "Visual cards grouped by time horizon. Drag, expand, and scan at a glance.",
    icon: LayoutGrid,
  },
  {
    name: "List",
    description:
      "A clean, sortable table with inline editing for fast bulk updates.",
    icon: List,
  },
  {
    name: "Board",
    description:
      "Kanban columns by status. Move goals through stages with drag and drop.",
    icon: Columns3,
  },
  {
    name: "Tree",
    description:
      "See the full parent/child hierarchy. Understand how every action connects upward.",
    icon: GitBranch,
  },
  {
    name: "Timeline",
    description:
      "Gantt-style bars showing deadlines and durations across the year.",
    icon: GanttChart,
  },
];

export function ViewsSection() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">
            Five Ways to{" "}
            <span className="landing-gradient-text">See Your Goals</span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Switch perspectives instantly. Every view shows the same data, organized differently.
          </p>
        </div>

        {/* View cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {views.map((view) => (
            <div
              key={view.name}
              className="landing-gradient-border flex flex-col items-center p-6 text-center transition-transform hover:-translate-y-1"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-violet-500/10">
                <view.icon className="size-6 text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-white">
                {view.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {view.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
