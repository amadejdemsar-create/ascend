/**
 * Raw JSON Schema tool definitions for the MCP server.
 *
 * These use plain JSON Schema objects (not Zod) because the low-level Server
 * class from @modelcontextprotocol/sdk returns them directly in tools/list
 * responses. Runtime validation of arguments happens inside tool handlers
 * using Zod v4.
 */

import {
  HORIZON_ENUM,
  STATUS_ENUM,
  PRIORITY_ENUM,
  TODO_STATUS_ENUM,
  CONTEXT_ENTRY_TYPE_ENUM,
  CONTEXT_LINK_TYPE_ENUM,
} from "@ascend/core";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

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
          enum: ["list", "tree", "timeline"],
          description: "Default goals view",
        },
      },
    },
  },

  // ── Context ───────────────────────────────────────────────────────

  {
    name: "set_context",
    description:
      "Create or update a context document. Provide an ID to update an existing entry, or omit it to create a new one. Content supports Markdown and [[Title]] backlinks.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of existing entry to update (omit to create new)" },
        title: { type: "string", description: "Document title (1 to 200 chars)" },
        content: {
          type: "string",
          description:
            "Document content in Markdown format. Use [[Title]] to link to other context documents.",
        },
        categoryId: { type: "string", description: "Category ID for organization (optional)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for cross-cutting discovery (up to 20)",
        },
      },
      required: ["title", "content"],
    },
  },

  {
    name: "get_context",
    description:
      "Get a context document by ID. Returns the full document including markdown content, tags, category, entry type, and typed outgoing/incoming links (ContextLink edges).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Context entry ID" },
      },
      required: ["id"],
    },
  },

  {
    name: "list_context",
    description:
      "List context documents, optionally filtered by category or tag. Returns title, type, tags, category, and updated date for each entry (content truncated to 200 chars for overview).",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "Filter by category ID" },
        tag: { type: "string", description: "Filter by tag (exact match)" },
      },
    },
  },

  {
    name: "search_context",
    description:
      "Search across all context documents. Supports three modes: 'text' (keyword full-text via tsvector), 'semantic' (AI meaning-based via embeddings, costs an embedding API call per query), or 'hybrid' (default, blends both with 0.55 text + 0.45 semantic weighting). Returns results ranked by blended score with matchedVia indicator.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (supports natural language)" },
        mode: {
          type: "string",
          enum: ["text", "semantic", "hybrid"],
          description: "Search mode: 'text' for keyword, 'semantic' for AI meaning, 'hybrid' for both (default: hybrid)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (1 to 100, default: 20)",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "delete_context",
    description:
      "Delete a context document by ID. Also cleans up backlink references from other documents.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Context entry ID to delete" },
      },
      required: ["id"],
    },
  },

  // ── Todos ──────────────────────────────────────────────────────────

  {
    name: "create_todo",
    description:
      "Create a new to-do with a title and optional details. Supports linking to a goal, assigning a category, setting priority, due/scheduled dates, and recurrence.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "To-do title (1 to 200 chars)" },
        description: { type: "string", description: "Longer description" },
        priority: {
          type: "string",
          enum: PRIORITY_ENUM,
          description: "Priority level (defaults to MEDIUM)",
        },
        goalId: { type: "string", description: "Parent goal ID to link this to-do to" },
        categoryId: { type: "string", description: "Category ID to assign" },
        dueDate: {
          type: "string",
          format: "date-time",
          description: "Due date (ISO 8601)",
        },
        scheduledDate: {
          type: "string",
          format: "date-time",
          description: "Scheduled date (ISO 8601)",
        },
        isRecurring: { type: "boolean", description: "Whether this to-do repeats" },
        recurrenceRule: {
          type: "string",
          description: "iCalendar RRULE string e.g. FREQ=DAILY or FREQ=WEEKLY;BYDAY=TU,TH",
        },
      },
      required: ["title"],
    },
  },

  {
    name: "get_todo",
    description:
      "Retrieve a single to-do by ID, including its linked goal details and category.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "To-do ID" },
      },
      required: ["id"],
    },
  },

  {
    name: "update_todo",
    description:
      "Update any fields on an existing to-do. All fields are optional except the to-do ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "To-do ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        priority: { type: "string", enum: PRIORITY_ENUM, description: "New priority" },
        status: {
          type: "string",
          enum: TODO_STATUS_ENUM,
          description: "New status (PENDING, DONE, or SKIPPED)",
        },
        goalId: { type: "string", description: "New linked goal ID" },
        categoryId: { type: "string", description: "New category ID" },
        dueDate: { type: "string", format: "date-time", description: "New due date (ISO 8601)" },
        scheduledDate: {
          type: "string",
          format: "date-time",
          description: "New scheduled date (ISO 8601)",
        },
        sortOrder: { type: "integer", description: "Display sort order" },
        isBig3: { type: "boolean", description: "Whether this is a Big 3 priority" },
        big3Date: {
          type: "string",
          format: "date-time",
          description: "Date this to-do is a Big 3 for (ISO 8601)",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "delete_todo",
    description: "Delete a to-do by ID. Verifies ownership before deleting.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "To-do ID" },
      },
      required: ["id"],
    },
  },

  {
    name: "list_todos",
    description:
      "List to-dos with optional filters for status, priority, category, goal, date range, and Big 3. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: TODO_STATUS_ENUM,
          description: "Filter by status",
        },
        priority: { type: "string", enum: PRIORITY_ENUM, description: "Filter by priority" },
        categoryId: { type: "string", description: "Filter by category ID" },
        goalId: { type: "string", description: "Filter by linked goal ID" },
        dateFrom: {
          type: "string",
          format: "date-time",
          description: "Filter: due date on or after this date (ISO 8601)",
        },
        dateTo: {
          type: "string",
          format: "date-time",
          description: "Filter: due date on or before this date (ISO 8601)",
        },
        isBig3: { type: "boolean", description: "Filter for Big 3 to-dos only" },
        limit: {
          type: "integer",
          description: "Max number of to-dos to return (default 50)",
          default: 50,
        },
        offset: {
          type: "integer",
          description: "Number of to-dos to skip for pagination (default 0)",
          default: 0,
        },
      },
    },
  },

  {
    name: "complete_todo",
    description:
      "Mark a to-do as completed. Triggers side effects: awards XP based on priority, updates recurring streak if applicable, and auto-increments linked goal progress.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "To-do ID to complete" },
      },
      required: ["id"],
    },
  },

  {
    name: "search_todos",
    description: "Search to-dos by title and description text (case insensitive).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text to match against titles and descriptions",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "get_daily_big3",
    description:
      "Get today's Big 3 priority to-dos (or for a specific date). Returns up to 3 to-dos marked as priorities.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          format: "date-time",
          description: "Date to get Big 3 for (defaults to today, ISO 8601)",
        },
      },
    },
  },

  {
    name: "set_daily_big3",
    description:
      "Set up to 3 to-dos as today's Big 3 priorities. Replaces any existing Big 3 for the given date.",
    inputSchema: {
      type: "object",
      properties: {
        todoIds: {
          type: "array",
          items: { type: "string" },
          description: "Up to 3 to-do IDs to mark as today's priorities",
        },
        date: {
          type: "string",
          format: "date-time",
          description: "Date to set Big 3 for (defaults to today, ISO 8601)",
        },
      },
      required: ["todoIds"],
    },
  },

  {
    name: "get_todos_for_date",
    description:
      "Get all to-dos for a specific date, including those scheduled or due on that day. Big 3 items are sorted first.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          format: "date-time",
          description: "Date to get to-dos for (ISO 8601)",
        },
      },
      required: ["date"],
    },
  },

  // ── Context Graph ──────────────────────────────────────────────────

  {
    name: "get_context_graph",
    description:
      "Return the typed-edge knowledge graph as { nodes, edges }. Each node is a context entry; each edge is a typed ContextLink. Caps at 1000 nodes by total degree. Filter by entry types (array), categoryId, or tag.",
    inputSchema: {
      type: "object",
      properties: {
        types: {
          type: "array",
          items: { type: "string", enum: CONTEXT_ENTRY_TYPE_ENUM },
          description: "Optional filter: only include nodes of these types.",
        },
        categoryId: {
          type: "string",
          description: "Optional filter: only entries in this category.",
        },
        tag: {
          type: "string",
          description: "Optional filter: only entries with this tag.",
        },
        cap: {
          type: "integer",
          minimum: 1,
          maximum: 5000,
          description: "Maximum number of nodes to return (default 1000).",
        },
      },
    },
  },

  {
    name: "get_node_neighbors",
    description:
      "Return the N-hop neighborhood of a context entry as { nodes, edges }. Depth 1 returns direct neighbors; depth 3 is the practical maximum for visualization.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The id of the center context entry.",
        },
        depth: {
          type: "integer",
          minimum: 1,
          maximum: 3,
          description: "How many hops to expand. Default 1.",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "get_related_context",
    description:
      "Return up to 20 related entries for a given context entry, ranked by a weighted heuristic: direct typed edge 1.0; 2-hop 0.5; shared tag 0.3 per tag; same category 0.2.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The id of the entry to find related entries for.",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "list_nodes_by_type",
    description:
      "List all context entries of a given type (NOTE, SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: CONTEXT_ENTRY_TYPE_ENUM,
          description: "The entry type to filter by.",
        },
      },
      required: ["type"],
    },
  },

  {
    name: "create_typed_link",
    description:
      "Create a typed directed edge from one context entry to another. Idempotent on (fromEntryId, toEntryId, type); duplicate calls return the existing link.",
    inputSchema: {
      type: "object",
      properties: {
        fromEntryId: { type: "string", description: "Source entry ID." },
        toEntryId: { type: "string", description: "Target entry ID." },
        type: {
          type: "string",
          enum: CONTEXT_LINK_TYPE_ENUM,
          description: "The relation type (REFERENCES default).",
        },
      },
      required: ["fromEntryId", "toEntryId"],
    },
  },

  {
    name: "remove_typed_link",
    description:
      "Delete a typed link by its id. Links with source=CONTENT (derived from wikilinks in entry content) cannot be deleted unless force=true; the right action is to edit the source entry's content.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Context link ID to delete." },
        force: {
          type: "boolean",
          description: "If true, delete CONTENT-source links too.",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "update_context_type",
    description:
      "Change the type of a context entry (NOTE, SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Context entry ID." },
        type: {
          type: "string",
          enum: CONTEXT_ENTRY_TYPE_ENUM,
          description: "The new entry type.",
        },
      },
      required: ["id", "type"],
    },
  },

  // ── Focus Sessions ────────────────────────────────────────────────

  {
    name: "get_focus_sessions",
    description:
      "List focus/Pomodoro sessions with optional filters by todo, goal, or date range.",
    inputSchema: {
      type: "object",
      properties: {
        todoId: { type: "string", description: "Filter by todo ID" },
        goalId: { type: "string", description: "Filter by goal ID" },
        dateFrom: {
          type: "string",
          format: "date-time",
          description: "ISO datetime lower bound",
        },
        dateTo: {
          type: "string",
          format: "date-time",
          description: "ISO datetime upper bound",
        },
      },
    },
  },

  // ── LLM / AI-native ──────────────────────────────────────────────

  {
    name: "get_context_map",
    description:
      "Get the current Context Map (user's synthesized graph: themes, principles, projects, tensions, orphans). Returns null if no map exists yet.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "refresh_context_map",
    description:
      "Trigger LLM synthesis to regenerate the Context Map. Cost-capped. Cooldown 30 minutes since last refresh. Returns updated ContextMap row.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "suggest_connections",
    description:
      "Given an entry id, suggest up to 5 typed-link suggestions to add. Uses semantic similarity + LLM rerank to identify high-value missing edges.",
    inputSchema: {
      type: "object",
      properties: {
        entryId: {
          type: "string",
          description: "The context entry ID to suggest connections for.",
        },
      },
      required: ["entryId"],
    },
  },

  {
    name: "detect_contradictions",
    description:
      "Scan the user's graph for content tensions. With entryId, only contradictions involving that entry; without, scans the entire graph for top 10 tensions. Returns up to 10.",
    inputSchema: {
      type: "object",
      properties: {
        entryId: {
          type: "string",
          description:
            "Optional: restrict contradiction scan to this entry. Omit to scan entire graph.",
        },
      },
    },
  },

  {
    name: "summarize_subgraph",
    description:
      "LLM-generated summary of the 1- or 2-hop neighborhood around a root entry. Useful for agents to ask 'what is around X?' and get a coherent narrative instead of raw graph data.",
    inputSchema: {
      type: "object",
      properties: {
        rootEntryId: {
          type: "string",
          description: "The center context entry ID to summarize around.",
        },
        depth: {
          type: "integer",
          minimum: 1,
          maximum: 2,
          description: "How many hops to include. Defaults to 2.",
        },
      },
      required: ["rootEntryId"],
    },
  },

  // ── Block Document ────────────────────────────────────────────────

  {
    name: "get_blocks",
    description:
      "Get the block document snapshot for a context entry. Returns the Lexical serialized state (root + children blocks) plus version. Returns null content if the entry has no block document yet (legacy markdown not yet migrated).",
    inputSchema: {
      type: "object",
      properties: {
        entryId: { type: "string", description: "The id of the context entry" },
      },
      required: ["entryId"],
    },
  },

  {
    name: "add_block",
    description:
      "Insert a new block into a context entry's block document. Specify position via afterBlockId (insert after existing block) or parentBlockId (nest as child). If neither, append to root.",
    inputSchema: {
      type: "object",
      properties: {
        entryId: { type: "string", description: "The context entry ID" },
        block: {
          type: "object",
          description:
            "Block to insert. Must have type field. Other fields depend on block type. Common types: paragraph, heading (with tag h1/h2/h3), list, listitem, code (with language), quote, callout (with variant info/warning/danger).",
          properties: {
            type: { type: "string" },
          },
          required: ["type"],
        },
        afterBlockId: {
          type: "string",
          description: "Optional: insert after the block with this Lexical key",
        },
        parentBlockId: {
          type: "string",
          description: "Optional: nest as child of this block",
        },
      },
      required: ["entryId", "block"],
    },
  },

  {
    name: "update_block",
    description:
      "Update properties of a single block by its Lexical key. Patch is shallow-merged into the block's properties (does not deep-merge nested children).",
    inputSchema: {
      type: "object",
      properties: {
        entryId: { type: "string", description: "The context entry ID" },
        blockId: {
          type: "string",
          description: "The Lexical key of the block to update",
        },
        patch: {
          type: "object",
          description: "Partial block fields to merge",
        },
      },
      required: ["entryId", "blockId", "patch"],
    },
  },

  {
    name: "move_block",
    description:
      "Reorder a block within its document. Specify new position via beforeId, afterId, or parentId (nest under).",
    inputSchema: {
      type: "object",
      properties: {
        entryId: { type: "string", description: "The context entry ID" },
        blockId: { type: "string", description: "The block to move" },
        beforeId: { type: "string", description: "Place before this block" },
        afterId: { type: "string", description: "Place after this block" },
        parentId: { type: "string", description: "Nest under this block" },
      },
      required: ["entryId", "blockId"],
    },
  },

  {
    name: "delete_block",
    description:
      "Remove a single block from a context entry. If the document would become empty, an empty paragraph block is inserted automatically (Lexical requires non-empty root).",
    inputSchema: {
      type: "object",
      properties: {
        entryId: { type: "string", description: "The context entry ID" },
        blockId: { type: "string", description: "The Lexical key of the block to remove" },
      },
      required: ["entryId", "blockId"],
    },
  },
];
