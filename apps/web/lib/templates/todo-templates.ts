export interface TodoTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  todos: Array<{
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    description?: string;
  }>;
}

export const TODO_TEMPLATES: TodoTemplate[] = [
  {
    id: "morning-routine",
    name: "Morning routine",
    description: "Start the day with hydration, focus, and intentional planning.",
    icon: "sunrise",
    todos: [
      { title: "Hydrate (500ml water)", priority: "MEDIUM" },
      { title: "10 min meditation", priority: "MEDIUM" },
      { title: "Review today's Big 3", priority: "HIGH" },
      { title: "30 min deep work block", priority: "HIGH" },
    ],
  },
  {
    id: "evening",
    name: "Evening wind-down",
    description: "Close the day with reflection and a plan for tomorrow.",
    icon: "moon",
    todos: [
      { title: "Reflect on today", priority: "LOW" },
      { title: "Plan tomorrow's Big 3", priority: "MEDIUM" },
      { title: "15 min read", priority: "LOW" },
    ],
  },
  {
    id: "weekly-review",
    name: "Weekly review",
    description: "Review the week, archive completed work, and plan ahead.",
    icon: "clipboard-check",
    todos: [
      { title: "Complete /review page", priority: "HIGH" },
      { title: "Archive completed goals", priority: "MEDIUM" },
      { title: "Plan next week's Big 3", priority: "HIGH" },
      { title: "Journal one insight from the week", priority: "MEDIUM" },
    ],
  },
  {
    id: "project-kickoff",
    name: "Project kickoff",
    description: "The first steps to move a new project from idea to execution.",
    icon: "flag",
    todos: [
      { title: "Write one-paragraph project brief", priority: "HIGH" },
      { title: "Identify first 3 milestones", priority: "HIGH" },
      { title: "Create tracking goal", priority: "MEDIUM" },
      { title: "Schedule deep work block", priority: "MEDIUM" },
      { title: "Share with accountability partner", priority: "LOW" },
    ],
  },
  {
    id: "deep-work",
    name: "Deep work session",
    description: "A single block of uninterrupted, focused work.",
    icon: "focus",
    todos: [
      {
        title: "2h focused work, no meetings, phone off",
        priority: "HIGH",
      },
    ],
  },
];
