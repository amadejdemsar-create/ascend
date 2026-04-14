export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  horizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
  priority: "LOW" | "MEDIUM" | "HIGH";
  data: {
    title: string;
    description?: string;
    specific?: string;
    measurable?: string;
    attainable?: string;
    relevant?: string;
    timely?: string;
    targetValue?: number;
    unit?: string;
  };
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "launch-product",
    name: "Launch a product",
    description:
      "Ship a public v1 with core features and an initial user base.",
    icon: "rocket",
    horizon: "QUARTERLY",
    priority: "HIGH",
    data: {
      title: "Launch v1 of [product name]",
      specific: "Ship a public v1 with at least 3 core features",
      measurable: "100 beta users signed up, 20% weekly active",
      attainable: "Build on existing stack and MVP scope",
      relevant: "Core revenue driver for the business",
      timely: "Launch by end of quarter",
    },
  },
  {
    id: "learn-skill",
    name: "Learn a new skill",
    description:
      "Reach working proficiency in a new skill through deliberate practice.",
    icon: "graduation-cap",
    horizon: "QUARTERLY",
    priority: "MEDIUM",
    data: {
      title: "Master [skill name]",
      specific: "Complete 3 projects using this skill",
      measurable: "Build and ship 3 end-to-end projects",
      attainable: "Dedicate 1 hour daily for 90 days",
      relevant: "Skill aligns with career direction",
      timely: "Reach proficiency by end of quarter",
    },
  },
  {
    id: "fitness",
    name: "Fitness goal",
    description:
      "Hit a concrete performance target with consistent, trackable progress.",
    icon: "dumbbell",
    horizon: "QUARTERLY",
    priority: "MEDIUM",
    data: {
      title: "Run a 5k under 25 minutes",
      specific: "Complete a 5k run in under 25 minutes",
      measurable: "Time a 5k run every 2 weeks, track progress",
      attainable: "Currently running 5k in 30 minutes",
      relevant: "Improving cardiovascular health and discipline",
      timely: "Achieve by end of quarter",
      targetValue: 25,
      unit: "minutes",
    },
  },
  {
    id: "save-money",
    name: "Save money target",
    description:
      "Automate savings and track monthly progress toward a yearly number.",
    icon: "piggy-bank",
    horizon: "YEARLY",
    priority: "HIGH",
    data: {
      title: "Save \u20AC15,000 this year",
      specific: "Accumulate \u20AC15,000 in savings and investments",
      measurable:
        "Track monthly balance, automate \u20AC1,250/month contributions",
      attainable: "Based on current income minus essential expenses",
      relevant: "Building emergency fund and investment base",
      timely: "Reach \u20AC15,000 by 31. 12. 2026",
      targetValue: 15000,
      unit: "EUR",
    },
  },
  {
    id: "build-habit",
    name: "Build a daily habit",
    description:
      "Stick with a new behavior for 30 days to make it part of your routine.",
    icon: "flame",
    horizon: "MONTHLY",
    priority: "MEDIUM",
    data: {
      title: "30 days of [habit name]",
      description:
        "Build consistency over 30 days. Set it as a recurring todo.",
    },
  },
  {
    id: "read-books",
    name: "Read N books",
    description:
      "Deliberate reading across fiction, non-fiction, and business.",
    icon: "book-open",
    horizon: "YEARLY",
    priority: "LOW",
    data: {
      title: "Read 12 books this year",
      specific: "Read 12 books across fiction, non-fiction, and business",
      measurable: "1 book per month, tracked in Context",
      attainable: "Average 300 pages = 30 minutes daily",
      relevant: "Deliberate learning and perspective broadening",
      timely: "12 books by 31. 12. 2026",
      targetValue: 12,
      unit: "books",
    },
  },
];
