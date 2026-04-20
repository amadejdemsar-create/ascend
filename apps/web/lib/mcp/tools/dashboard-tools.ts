import { dashboardService } from "@/lib/services/dashboard-service";
import { goalService } from "@/lib/services/goal-service";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };

// Minimal shape the tree formatter needs. The real goalService.getTree
// returns richer objects but formatTree only reads these fields.
interface FormatTreeNode {
  title: string;
  horizon: string;
  priority: string;
  progress: number;
  status: string;
  children?: FormatTreeNode[];
}

/**
 * Format a goal hierarchy tree as an indented text structure.
 * Each level increases the indentation by two spaces.
 */
function formatTree(goals: FormatTreeNode[], indent: number = 0): string {
  return goals
    .map((g) => {
      const prefix = "  ".repeat(indent);
      const status = g.status === "COMPLETED" ? "x" : " ";
      const line = `${prefix}- [${status}] ${g.title} (${g.horizon}, ${g.priority}, ${g.progress}%)`;
      const children =
        g.children?.length ? "\n" + formatTree(g.children, indent + 1) : "";
      return line + children;
    })
    .join("\n");
}

/**
 * Handle all dashboard-related MCP tool calls.
 * Provides read-only views into dashboard data, priorities, stats, and the goal hierarchy.
 */
export async function handleDashboardTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "get_dashboard": {
        const data = await dashboardService.getDashboardData(userId);

        const weeklyLines = data.weeklyFocus
          .map(
            (g) =>
              `- [${g.status}] ${g.title} (${g.priority}, ${g.progress}%)`,
          )
          .join("\n");

        const categoryLines = data.progressOverview
          .map(
            (c) =>
              `- ${c.name}: ${c.completed}/${c.total} (${c.percentage}%)`,
          )
          .join("\n");

        const stats = data.streaksStats;
        const statsLines = [
          `Level: ${stats.level}`,
          `XP: ${stats.currentXp}`,
          `Current Streak: ${stats.currentStreak} days`,
          `Completed This Month: ${stats.completedThisMonth}`,
          `Total Goals: ${stats.totalGoals}`,
          `Total Completed: ${stats.totalCompleted}`,
          `Completion Rate: ${stats.completionRate}%`,
        ].join("\n");

        const deadlineLines = data.upcomingDeadlines
          .map((d) => `- ${d.title} (${d.horizon}) due: ${d.deadline}`)
          .join("\n");

        const formatted =
          "## Dashboard Summary\n\n" +
          "### This Week's Focus\n" +
          (weeklyLines || "No weekly focus goals.") +
          "\n\n### Progress by Category\n" +
          (categoryLines || "No category data yet.") +
          "\n\n### Stats\n" +
          statsLines +
          "\n\n### Upcoming Deadlines\n" +
          (deadlineLines || "No upcoming deadlines.") +
          "\n\n---\nRaw data:\n" +
          JSON.stringify(data, null, 2);

        return { content: [{ type: "text", text: formatted }] };
      }

      case "get_current_priorities": {
        const [inProgress, notStarted] = await Promise.all([
          goalService.list(userId, {
            horizon: "WEEKLY",
            status: "IN_PROGRESS",
          }),
          goalService.list(userId, {
            horizon: "WEEKLY",
            status: "NOT_STARTED",
          }),
        ]);

        const combined = [...inProgress, ...notStarted]
          .sort((a, b) => {
            const pDiff =
              (PRIORITY_ORDER[b.priority] ?? 0) -
              (PRIORITY_ORDER[a.priority] ?? 0);
            if (pDiff !== 0) return pDiff;
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return (
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            );
          })
          .slice(0, 10);

        const lines = combined
          .map(
            (g, i) =>
              `${i + 1}. [${g.priority}] ${g.title} - ${g.status} (${g.progress}%)${g.deadline ? " due: " + new Date(g.deadline).toISOString() : ""}`,
          )
          .join("\n");

        const formatted =
          "## Current Priorities (Top 10 Weekly Goals)\n\n" +
          (lines || "No active weekly goals found.");

        return { content: [{ type: "text", text: formatted }] };
      }

      case "get_stats": {
        const data = await dashboardService.getDashboardData(userId);
        const stats = data.streaksStats;

        const formatted =
          "## Goal Statistics\n\n" +
          `Level: ${stats.level}\n` +
          `XP: ${stats.currentXp}\n` +
          `Current Streak: ${stats.currentStreak} days\n` +
          `Goals Completed This Month: ${stats.completedThisMonth}\n` +
          `Total Goals: ${stats.totalGoals}\n` +
          `Total Completed: ${stats.totalCompleted}\n` +
          `Overall Completion Rate: ${stats.completionRate}%\n` +
          "\n---\nRaw data:\n" +
          JSON.stringify(stats, null, 2);

        return { content: [{ type: "text", text: formatted }] };
      }

      case "get_timeline": {
        const tree = await goalService.getTree(userId);
        const formatted =
          "## Goal Timeline (Yearly > Quarterly > Monthly > Weekly)\n\n" +
          (tree.length > 0 ? formatTree(tree as unknown as FormatTreeNode[]) : "No goals found.") +
          "\n\n---\nRaw data:\n" +
          JSON.stringify(tree, null, 2);

        return { content: [{ type: "text", text: formatted }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown dashboard tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }) },
      ],
      isError: true,
    };
  }
}
