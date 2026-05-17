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
  ALLOWED_MIME_TYPES_ARRAY,
  EXTRACTION_STATUS_VALUES,
  DATABASE_FIELD_TYPE_VALUES,
  DATABASE_VIEW_TYPE_VALUES,
  NODE_TYPE_VALUES,
  ACTIVITY_EVENT_TYPE_VALUES,
  ANNOTATION_KIND_VALUES,
} from "@ascend/core";

const DATABASE_FIELD_TYPE_ENUM = [...DATABASE_FIELD_TYPE_VALUES];
const DATABASE_VIEW_TYPE_ENUM = [...DATABASE_VIEW_TYPE_VALUES];
const NODE_TYPE_ENUM = [...NODE_TYPE_VALUES];
const ACTIVITY_EVENT_TYPE_ENUM = [...ACTIVITY_EVENT_TYPE_VALUES];
const ANNOTATION_KIND_ENUM = [...ANNOTATION_KIND_VALUES];

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

  // ── File Operations ──────────────────────────────────────────────

  {
    name: "upload_file",
    description:
      "Upload a file to Ascend by URL or base64 content. Exactly one of url or base64 must be provided. The file is stored in R2 and extraction (text, page count) is enqueued automatically. Optionally link to an existing ContextEntry via entryId. When entryId is omitted, the file exists standalone and can be linked later.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "HTTPS URL to fetch the file from. Only https: scheme is allowed (SSRF protection). Mutually exclusive with base64.",
        },
        base64: {
          type: "string",
          description:
            "Base64-encoded file content. Mutually exclusive with url.",
        },
        mimeType: {
          type: "string",
          enum: [...ALLOWED_MIME_TYPES_ARRAY],
          description: "MIME type of the file (must be in the allowlist).",
        },
        filename: {
          type: "string",
          description: "Original filename (1 to 500 chars).",
        },
        entryId: {
          type: "string",
          description:
            "Optional ContextEntry ID to link this file to. The entry must exist and belong to the user.",
        },
      },
      required: ["mimeType", "filename"],
    },
  },

  {
    name: "get_file_content",
    description:
      "Get a file's metadata and extracted content. Returns the current extraction state without blocking; if extraction is not yet complete, extractionStatus will be PENDING or EXTRACTING. Extracted text is capped at 100,000 characters.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "The file ID to retrieve." },
      },
      required: ["fileId"],
    },
  },

  {
    name: "list_files_by_type",
    description:
      "List the current user's files, optionally filtered by MIME type prefix (e.g., 'image/', 'audio/', 'application/pdf'). Returns metadata for each file including extraction status. Sorted by most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        mimeTypePrefix: {
          type: "string",
          description:
            "Filter files whose MIME type starts with this prefix (e.g., 'image/' for all images).",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of files to return (default 50, max 200).",
          default: 50,
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Number of files to skip for pagination (default 0).",
          default: 0,
        },
      },
    },
  },

  // ── Database Operations (Wave 5) ────────────────────────────────────

  {
    name: "create_database",
    description:
      "Create a new typed database with a default 'Name' text column and a Table view. Returns the database ID, context entry ID, fields, and views.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Database name (1 to 200 chars). Becomes the ContextEntry title.",
        },
        parentEntryId: {
          type: "string",
          description: "Optional parent ContextEntry ID to attach the database to.",
        },
      },
      required: ["name"],
    },
  },

  {
    name: "add_field",
    description:
      "Add a new field (column) to a database. Supports TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, RELATION, FORMULA, USER, CHECKBOX, RATING, URL, EMAIL, PHONE, FILE. The field is appended at the end.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: { type: "string", description: "The database ID" },
        name: { type: "string", description: "Field name (1 to 80 chars)" },
        type: {
          type: "string",
          enum: DATABASE_FIELD_TYPE_ENUM,
          description: "The field type",
        },
        config: {
          type: "object",
          description: "Type-specific configuration (e.g., options for SELECT, expression for FORMULA, targetDatabaseId for RELATION)",
        },
      },
      required: ["databaseId", "name", "type"],
    },
  },

  {
    name: "update_field",
    description:
      "Update a database field's name, config, or position. Cannot change the field type (use delete + add for that).",
    inputSchema: {
      type: "object",
      properties: {
        fieldId: { type: "string", description: "The field ID to update" },
        name: { type: "string", description: "New field name (1 to 80 chars)" },
        config: {
          type: "object",
          description: "Updated type-specific configuration",
        },
        position: {
          type: "integer",
          minimum: 0,
          description: "New position index for reordering",
        },
      },
      required: ["fieldId"],
    },
  },

  {
    name: "delete_field",
    description:
      "Delete a field from a database. Removes the field from all rows' properties. Cannot delete the primary (Name) field. If the field is a RELATION type, all corresponding ContextLink rows are also removed.",
    inputSchema: {
      type: "object",
      properties: {
        fieldId: { type: "string", description: "The field ID to delete" },
      },
      required: ["fieldId"],
    },
  },

  {
    name: "create_row",
    description:
      "Create a new row in a database. Each row is a ContextEntry of type RECORD with a BlockDocument for its body. Optionally provide initial property values.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: { type: "string", description: "The database to add the row to" },
        properties: {
          type: "object",
          description: "Initial property values keyed by field ID. All fields are optional; omitted fields get null.",
        },
      },
      required: ["databaseId"],
    },
  },

  {
    name: "update_row",
    description:
      "Update a row's property values. Provide a partial patch; only the fields included in propertiesPatch are changed. RELATION field changes automatically create/remove ContextLink rows.",
    inputSchema: {
      type: "object",
      properties: {
        rowId: { type: "string", description: "The row ID to update" },
        propertiesPatch: {
          type: "object",
          description: "Partial property values keyed by field ID. Set a value to null to clear it.",
        },
      },
      required: ["rowId", "propertiesPatch"],
    },
  },

  {
    name: "delete_row",
    description:
      "Delete a row from a database. This also deletes the backing ContextEntry (type RECORD), its BlockDocument, and all RELATION links from/to this row.",
    inputSchema: {
      type: "object",
      properties: {
        rowId: { type: "string", description: "The row ID to delete" },
      },
      required: ["rowId"],
    },
  },

  {
    name: "create_view",
    description:
      "Create a new view for a database. Supported types: TABLE, BOARD (requires groupByFieldId in config), CALENDAR (requires dateFieldId), GALLERY, TIMELINE (requires startFieldId + endFieldId).",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: { type: "string", description: "The database to add the view to" },
        name: { type: "string", description: "View name (1 to 80 chars)" },
        type: {
          type: "string",
          enum: DATABASE_VIEW_TYPE_ENUM,
          description: "The view type",
        },
        config: {
          type: "object",
          description: "View-type-specific configuration (column widths, groupBy, dateField, etc.)",
        },
      },
      required: ["databaseId", "name", "type"],
    },
  },

  {
    name: "update_view",
    description:
      "Update a view's name or configuration. Use this to change filters, sorts, column widths, groupBy, etc.",
    inputSchema: {
      type: "object",
      properties: {
        viewId: { type: "string", description: "The view ID to update" },
        name: { type: "string", description: "New view name (1 to 80 chars)" },
        config: {
          type: "object",
          description: "Updated view configuration",
        },
      },
      required: ["viewId"],
    },
  },

  {
    name: "query_database",
    description:
      "Query rows from a database with optional filtering, sorting, and pagination. Can use a saved view's filters/sorts via viewId, or provide inline filter/sort to override. Returns paginated rows with computed formula values.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: { type: "string", description: "The database to query" },
        viewId: {
          type: "string",
          description: "Optional view ID to use as the base filter/sort config",
        },
        filter: {
          type: "object",
          description: "Optional filter object with combinator (AND/OR) and clauses array. Each clause has fieldId, op, and value.",
        },
        sort: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fieldId: { type: "string" },
              direction: { type: "string", enum: ["asc", "desc"] },
            },
            required: ["fieldId", "direction"],
          },
          description: "Optional sort specification (array of {fieldId, direction})",
        },
        page: {
          type: "integer",
          minimum: 1,
          description: "Page number (default 1)",
          default: 1,
        },
        perPage: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Rows per page (default 200, max 500)",
          default: 200,
        },
      },
      required: ["databaseId"],
    },
  },

  // ── Versioning / Time-Travel (Wave 7) ───────────────────────────────

  {
    name: "list_versions",
    description:
      "List the version history for a node (most recent first). Returns up to 100 versions per call. Use for any nodeType: CONTEXT_ENTRY, GOAL, TODO, DATABASE_ROW, or DATABASE_FIELD.",
    inputSchema: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          enum: NODE_TYPE_ENUM,
          description: "The kind of node.",
        },
        nodeId: {
          type: "string",
          description: "The ID of the entity (entry id, goal id, etc.).",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Max versions to return (default 20, max 100).",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor (versionId of the last item from the previous page).",
        },
      },
      required: ["nodeType", "nodeId"],
    },
  },

  {
    name: "get_version",
    description:
      "Fetch a specific version including the full serialized payload. Use this to see the entity's exact state at that point in time.",
    inputSchema: {
      type: "object",
      properties: {
        versionId: {
          type: "string",
          description: "The version ID returned by list_versions.",
        },
      },
      required: ["versionId"],
    },
  },

  {
    name: "diff_versions",
    description:
      "Compute a structured diff between two versions of the same node, OR between a version and the current live state (pass fromVersionId as null). The result is a discriminated union by nodeType: block-diff for CONTEXT_ENTRY (Lexical block tree), field-diff for GOAL/TODO (entity metadata), property-diff for DATABASE_ROW (typed properties), field-config-diff for DATABASE_FIELD (schema changes).",
    inputSchema: {
      type: "object",
      properties: {
        fromVersionId: {
          type: ["string", "null"],
          description: "Older version ID. Pass null to diff against the current live state.",
        },
        toVersionId: {
          type: "string",
          description: "Newer version ID.",
        },
      },
      required: ["fromVersionId", "toVersionId"],
    },
  },

  {
    name: "restore_version",
    description:
      "Restore the entity to a previous version. Writes a forward snapshot of the current state first (so the user can undo the restore), then overwrites the entity. Pass dryRun=true to preview the payload that would be written without mutating. ContextLinks (edges) are NOT time-traveled and are preserved as-is.",
    inputSchema: {
      type: "object",
      properties: {
        versionId: {
          type: "string",
          description: "The version to restore.",
        },
        dryRun: {
          type: "boolean",
          description: "If true, return the payload that would be written without restoring.",
        },
      },
      required: ["versionId"],
    },
  },

  {
    name: "branch_node",
    description:
      "Fork an entity at a historical version into a new entity. The new entity gets the version's payload; a DERIVED_FROM ContextLink is created from the new entity to the original. Only branch-eligible types: CONTEXT_ENTRY of type NOTE/SOURCE/PROJECT/PERSON/DECISION/QUESTION/AREA, or DATABASE_ROW. Hard cap of 50 derivatives per source; soft warning at >5.",
    inputSchema: {
      type: "object",
      properties: {
        versionId: {
          type: "string",
          description: "The source version to branch from.",
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          description: "Title for the new entity.",
        },
      },
      required: ["versionId", "title"],
    },
  },

  // ── Workspace + Activity Feed (Wave 8) ──────────────────────────────

  {
    name: "list_workspaces",
    description:
      "List the workspaces the current user is a member of. In Wave 8 single-user this returns exactly one workspace.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_workspace",
    description:
      "Get a workspace by ID. Omit `id` to get the current workspace. Returns { id, slug, name, ownerId, createdAt, updatedAt }.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "Workspace ID. Defaults to the current workspace if omitted.",
        },
      },
    },
  },

  {
    name: "get_activity_events",
    description:
      "Paginated workspace activity feed (newest first). Returns NODE_CREATED, NODE_UPDATED, NODE_DELETED, NODE_RESTORED, NODE_BRANCHED, LINK_CREATED, LINK_REMOVED, and MEMBER_* events. Use `cursor` from the previous response's `nextCursor` to fetch the next page.",
    inputSchema: {
      type: "object",
      properties: {
        eventType: {
          type: "array",
          items: { type: "string", enum: ACTIVITY_EVENT_TYPE_ENUM },
          description: "Filter to these event types.",
        },
        since: {
          type: "string",
          format: "date-time",
          description:
            "ISO 8601 datetime; only return events after this.",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from previous response.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description:
            "Maximum number of events to return (default 50).",
          default: 50,
        },
      },
    },
  },

  // ── Canvas (Wave 9) ──────────────────────────────────────────────────

  {
    name: "get_canvas_layout",
    description:
      "Get a spatial canvas layout including the full Excalidraw scene (elements, appState, files) and the list of CanvasNodes (each binds a ContextEntry to an x/y position on the canvas). Omit `layoutId` to fetch the user's default layout (lazily created on first call). Use this before set_node_position or create_annotation to inspect current canvas state.",
    inputSchema: {
      type: "object",
      properties: {
        layoutId: {
          type: "string",
          description:
            "CanvasLayout ID. Defaults to the user's default layout if omitted.",
        },
      },
    },
  },

  {
    name: "set_node_position",
    description:
      "Move a context entry's card on a canvas layout. Upserts the CanvasNode at (x, y) with optional width/height. Coordinates are in canvas-space (Excalidraw uses arbitrary numeric coords; positive x is right, positive y is down). w defaults to 240, h defaults to 140. The Excalidraw rectangle in the scene is also patched so the next render shows the card at the new position.",
    inputSchema: {
      type: "object",
      properties: {
        layoutId: {
          type: "string",
          description: "CanvasLayout ID.",
        },
        contextEntryId: {
          type: "string",
          description:
            "ContextEntry ID to position. Must belong to the same user + workspace.",
        },
        x: { type: "number", description: "Canvas-space x coordinate." },
        y: { type: "number", description: "Canvas-space y coordinate." },
        w: {
          type: "number",
          minimum: 0.01,
          description: "Card width (default 240).",
        },
        h: {
          type: "number",
          minimum: 0.01,
          description: "Card height (default 140).",
        },
      },
      required: ["layoutId", "contextEntryId", "x", "y"],
    },
  },

  {
    name: "create_annotation",
    description:
      "Append a free-form annotation (freehand stroke, shape, sticky note, frame, or text label) to a canvas layout. Annotations live only on the canvas; they are NOT new ContextEntries. Use this to highlight cards, add notes, or sketch around the visual graph.",
    inputSchema: {
      type: "object",
      properties: {
        layoutId: {
          type: "string",
          description: "CanvasLayout ID to append the annotation to.",
        },
        kind: {
          type: "string",
          enum: ANNOTATION_KIND_ENUM,
          description:
            "Annotation type. 'freehand' requires geometry.points; 'text' and 'sticky' require content.",
        },
        geometry: {
          type: "object",
          description: "Annotation position + size in canvas-space.",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            w: { type: "number", minimum: 0.01 },
            h: { type: "number", minimum: 0.01 },
            points: {
              type: "array",
              description:
                "For freehand: list of {x, y} points relative to (geometry.x, geometry.y).",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
                required: ["x", "y"],
              },
            },
          },
          required: ["x", "y"],
        },
        content: {
          type: "string",
          maxLength: 10000,
          description: "Text content for 'text' or 'sticky' annotations.",
        },
      },
      required: ["layoutId", "kind", "geometry"],
    },
  },

  // ── Wave 10: MCP federation control ────────────────────────────
  {
    name: "list_mcp_connections",
    description:
      "List the user's federated MCP server connections. Each row includes name, slug (the tool prefix used by federated tools), endpoint, enabled status, and last-test result.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "test_mcp_connection",
    description:
      "Run a live health check against an MCP connection: calls initialize and tools/list against the upstream, refreshes the cached tool list on success, records the error message on failure. Returns { healthy, toolCount?, error? }.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "McpServerConnection id" },
      },
      required: ["id"],
    },
  },
  {
    name: "enable_mcp_connection",
    description:
      "Enable a federated MCP connection. Its tools start appearing in /api/mcp tools/list responses again.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "McpServerConnection id" },
      },
      required: ["id"],
    },
  },
  {
    name: "disable_mcp_connection",
    description:
      "Disable a federated MCP connection. Its tools stop appearing in /api/mcp tools/list responses; the connection row + credentials are kept.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "McpServerConnection id" },
      },
      required: ["id"],
    },
  },

  // ── Wave 10: External data ────────────────────────────────────
  {
    name: "list_external_sources",
    description:
      "List the user's external data sources (e.g., GitHub). Each row includes provider, name, scope config, enabled status, and last-refresh timestamp.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_external_data",
    description:
      "Query an external data source for rows of a given shape (e.g., GitHub Issues or PRs). Returns paginated rows + next cursor. Filter clauses support equality + contains on common fields like state, author, labels, milestone, repo.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "ExternalDataSource id" },
        shape: {
          type: "string",
          description:
            "Shape id from the source's listShapes (e.g., 'issues', 'pulls').",
        },
        filter: {
          type: "array",
          description:
            "Array of filter clauses: { field, op, value? }. ops: eq, ne, in, contains, gt, gte, lt, lte, isEmpty.",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              op: { type: "string" },
              value: {},
            },
            required: ["field", "op"],
          },
        },
        sort: {
          type: "array",
          description: "Sort clauses: { field, direction }.",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              direction: { type: "string", enum: ["asc", "desc"] },
            },
            required: ["field", "direction"],
          },
        },
        cursor: { type: "string", description: "Opaque pagination cursor." },
        perPage: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["sourceId", "shape"],
    },
  },
  {
    name: "refresh_external_schema",
    description:
      "Re-fetch the per-shape field schemas for an external data source and cache them on the source row. Use after the upstream adds new labels, milestones, or other enumerated values.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "ExternalDataSource id" },
      },
      required: ["sourceId"],
    },
  },
];
