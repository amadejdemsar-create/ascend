/**
 * Raw JSON Schema tool definitions for the MCP server.
 *
 * These use plain JSON Schema objects (not Zod) because the low-level Server
 * class from @modelcontextprotocol/sdk returns them directly in tools/list
 * responses. Runtime validation of arguments happens inside tool handlers
 * using Zod v4.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const HORIZON_ENUM = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;
const STATUS_ENUM = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
const PRIORITY_ENUM = ["LOW", "MEDIUM", "HIGH"] as const;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── Goal CRUD ──────────────────────────────────────────────────────

  {
    name: "create_goal",
    description:
      "Create a new goal with a title and time horizon. Supports SMART fields, parent linking, categories, and measurable targets.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Goal title (1 to 200 chars)" },
        horizon: {
          type: "string",
          enum: HORIZON_ENUM,
          description: "Time horizon: YEARLY, QUARTERLY, MONTHLY, or WEEKLY",
        },
        parentId: {
          type: "string",
          description: "ID of the parent goal (must be a broader horizon)",
        },
        categoryId: { type: "string", description: "Category ID to assign" },
        priority: {
          type: "string",
          enum: PRIORITY_ENUM,
          description: "Priority level (defaults to MEDIUM)",
        },
        description: { type: "string", description: "Longer description" },
        startDate: {
          type: "string",
          format: "date-time",
          description: "When to start working on this goal (ISO 8601)",
        },
        deadline: {
          type: "string",
          format: "date-time",
          description: "Target completion date (ISO 8601)",
        },
        specific: { type: "string", description: "SMART: What exactly will you accomplish?" },
        measurable: { type: "string", description: "SMART: How will you measure progress?" },
        attainable: { type: "string", description: "SMART: Is this realistic?" },
        relevant: { type: "string", description: "SMART: Why does this matter?" },
        timely: { type: "string", description: "SMART: What is the timeframe?" },
        targetValue: {
          type: "number",
          description: "Numeric target for measurable goals (e.g. 100 for 100 pushups)",
        },
        unit: { type: "string", description: "Unit for the target value (e.g. pushups, pages, km)" },
        notes: { type: "string", description: "Free-form notes" },
      },
      required: ["title", "horizon"],
    },
  },

  {
    name: "get_goal",
    description:
      "Retrieve a single goal by ID, including its category, parent, and child goals.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Goal ID" },
      },
      required: ["id"],
    },
  },

  {
    name: "update_goal",
    description:
      "Update any fields on an existing goal. All fields are optional except the goal ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Goal ID" },
        title: { type: "string", description: "New title" },
        horizon: { type: "string", enum: HORIZON_ENUM, description: "New time horizon" },
        parentId: { type: "string", description: "New parent goal ID" },
        categoryId: { type: "string", description: "New category ID" },
        priority: { type: "string", enum: PRIORITY_ENUM, description: "New priority" },
        description: { type: "string", description: "New description" },
        startDate: { type: "string", format: "date-time", description: "New start date" },
        deadline: { type: "string", format: "date-time", description: "New deadline" },
        specific: { type: "string", description: "SMART: specific" },
        measurable: { type: "string", description: "SMART: measurable" },
        attainable: { type: "string", description: "SMART: attainable" },
        relevant: { type: "string", description: "SMART: relevant" },
        timely: { type: "string", description: "SMART: timely" },
        targetValue: { type: "number", description: "New target value" },
        unit: { type: "string", description: "New unit" },
        notes: { type: "string", description: "New notes" },
        status: {
          type: "string",
          enum: STATUS_ENUM,
          description: "New status (NOT_STARTED, IN_PROGRESS, COMPLETED, ABANDONED)",
        },
        progress: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Manual progress percentage (0 to 100)",
        },
        currentValue: { type: "number", description: "Current measurable value" },
        sortOrder: { type: "number", description: "Display sort order" },
      },
      required: ["id"],
    },
  },

  {
    name: "delete_goal",
    description:
      "Delete a goal. By default, child goals become orphans. Set cascade to true to delete children recursively.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Goal ID" },
        cascade: {
          type: "boolean",
          description: "If true, also delete all child goals recursively",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "list_goals",
    description:
      "List goals with optional filters for horizon, status, priority, category, and parent. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        horizon: { type: "string", enum: HORIZON_ENUM, description: "Filter by time horizon" },
        status: { type: "string", enum: STATUS_ENUM, description: "Filter by status" },
        priority: { type: "string", enum: PRIORITY_ENUM, description: "Filter by priority" },
        categoryId: { type: "string", description: "Filter by category ID" },
        parentId: {
          type: ["string", "null"],
          description: "Filter by parent ID. Use null for top-level goals only.",
        },
        limit: {
          type: "integer",
          description: "Max number of goals to return (default 50)",
          default: 50,
        },
        offset: {
          type: "integer",
          description: "Number of goals to skip for pagination (default 0)",
          default: 0,
        },
      },
    },
  },

  {
    name: "search_goals",
    description:
      "Search goals by title or description text (case insensitive).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text to match against titles and descriptions" },
      },
      required: ["query"],
    },
  },

  // ── Progress ───────────────────────────────────────────────────────

  {
    name: "add_progress",
    description:
      "Log a progress entry for a goal. Increments the current value and recalculates progress percentage if a target is set.",
    inputSchema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "Goal ID to log progress for" },
        value: { type: "number", description: "Positive numeric value to add" },
        note: { type: "string", description: "Optional note about this progress entry" },
      },
      required: ["goalId", "value"],
    },
  },

  {
    name: "get_progress_history",
    description:
      "Get all progress log entries for a goal, ordered by most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "Goal ID" },
      },
      required: ["goalId"],
    },
  },

  // ── Categories ─────────────────────────────────────────────────────

  {
    name: "create_category",
    description:
      "Create a new category for organizing goals. Supports color, icon, and nesting via parentId.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name (1 to 100 chars)" },
        color: {
          type: "string",
          pattern: "^#[0-9A-Fa-f]{6}$",
          description: "Hex color code (e.g. #4F46E5)",
        },
        icon: { type: "string", description: "Lucide icon name (e.g. Target, BookOpen)" },
        parentId: { type: "string", description: "Parent category ID for nesting" },
      },
      required: ["name"],
    },
  },

  {
    name: "update_category",
    description: "Update an existing category's name, color, icon, or sort order.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Category ID" },
        name: { type: "string", description: "New name" },
        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", description: "New hex color" },
        icon: { type: "string", description: "New icon name" },
        sortOrder: { type: "number", description: "Display sort order" },
      },
      required: ["id"],
    },
  },

  {
    name: "delete_category",
    description: "Delete a category. Goals in this category will become uncategorized.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Category ID" },
      },
      required: ["id"],
    },
  },

  {
    name: "list_categories",
    description: "List all categories for the current user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Dashboard and Stats ────────────────────────────────────────────

  {
    name: "get_dashboard",
    description:
      "Get the full dashboard view: weekly focus goals, progress overview, upcoming deadlines, and streak stats.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_current_priorities",
    description:
      "Get this week's priority goals sorted by priority and deadline.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_stats",
    description:
      "Get user statistics: completion rates, streak data, and goal counts by status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_timeline",
    description:
      "Get the full goal hierarchy tree: yearly goals with nested quarterly, monthly, and weekly children.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Bulk Operations ────────────────────────────────────────────────

  {
    name: "complete_goals",
    description:
      "Mark multiple goals as completed in one operation.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of goal IDs to mark as completed",
        },
      },
      required: ["ids"],
    },
  },

  {
    name: "move_goal",
    description:
      "Move a goal to a different horizon or under a different parent. Validates hierarchy rules.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Goal ID to move" },
        horizon: { type: "string", enum: HORIZON_ENUM, description: "New time horizon" },
        parentId: {
          type: ["string", "null"],
          description: "New parent goal ID, or null to make it a top-level goal",
        },
      },
      required: ["id"],
    },
  },

  // ── Data ───────────────────────────────────────────────────────────

  {
    name: "export_data",
    description:
      "Export all goals and categories in the specified format.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["JSON", "CSV", "MARKDOWN"],
          description: "Export format",
        },
      },
      required: ["format"],
    },
  },

  {
    name: "import_data",
    description:
      "Import goals and categories from a JSON string. Creates new records without overwriting existing data.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "JSON string containing goals and categories to import",
        },
        format: {
          type: "string",
          enum: ["JSON"],
          description: "Import format (currently only JSON supported)",
          default: "JSON",
        },
      },
      required: ["data"],
    },
  },

  // ── Settings ───────────────────────────────────────────────────────

  {
    name: "get_settings",
    description: "Get the current user settings (theme, default view).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "update_settings",
    description: "Update user settings such as theme and default view.",
    inputSchema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          enum: ["light", "dark", "system"],
          description: "Color theme preference",
        },
        defaultView: {
          type: "string",
          enum: ["list", "board", "tree", "timeline"],
          description: "Default goals view",
        },
      },
    },
  },
];
