import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { handleGoalTool } from "@/lib/mcp/tools/goal-tools";
import { handleCategoryTool } from "@/lib/mcp/tools/category-tools";
import { handleContextTool } from "@/lib/mcp/tools/context-tools";
import { handleTodoTool } from "@/lib/mcp/tools/todo-tools";
import { handleDashboardTool } from "@/lib/mcp/tools/dashboard-tools";
import { createTestUser, deleteTestUser } from "./helpers";

// Smoke tests for the MCP handler dispatch layer. These exercise the
// "validate -> service -> McpContent" path end to end for at least one
// tool per handler group, plus a few known error paths. The goal is to
// catch regressions where a handler starts throwing instead of
// returning `{ isError: true, content: [...] }`, or where a schema
// rename breaks the Zod parse step.

describe("MCP handlers", () => {
  let user: { id: string; apiKey: string };

  beforeAll(async () => {
    user = await createTestUser("mcp");
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
  });

  describe("handleCategoryTool", () => {
    it("create_category returns a parseable JSON payload on success", async () => {
      const result = await handleCategoryTool(user.id, "create_category", {
        name: "MCP Category",
        color: "#10B981",
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      const payload = JSON.parse(result.content[0].text);
      expect(payload.name).toBe("MCP Category");
      expect(payload.userId).toBe(user.id);
    });

    it("create_category returns isError with Zod details on invalid input", async () => {
      const result = await handleCategoryTool(user.id, "create_category", {
        // name is required; passing none triggers a ZodError
        color: "#ffffff",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Validation error");
    });

    it("list_categories returns a mixed human-readable + JSON blob", async () => {
      const result = await handleCategoryTool(user.id, "list_categories", {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("## Categories");
    });

    it("unknown category tool name returns isError", async () => {
      const result = await handleCategoryTool(user.id, "not_a_real_tool", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown category tool");
    });
  });

  describe("handleGoalTool", () => {
    it("create_goal returns a parseable JSON payload on success", async () => {
      const result = await handleGoalTool(user.id, "create_goal", {
        title: "MCP Goal",
        horizon: "WEEKLY",
      });
      expect(result.isError).toBeUndefined();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.title).toBe("MCP Goal");
      expect(payload.horizon).toBe("WEEKLY");
    });

    it("get_goal returns isError for a non-existent id", async () => {
      const result = await handleGoalTool(user.id, "get_goal", {
        id: "does-not-exist",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Goal not found");
    });

    it("create_goal returns isError on invalid horizon", async () => {
      const result = await handleGoalTool(user.id, "create_goal", {
        title: "Bad horizon",
        horizon: "MILLENNIAL",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("handleContextTool", () => {
    it("set_context creates a new entry and parses backlinks", async () => {
      // First seed a target so the [[Target]] backlink resolves.
      const target = await handleContextTool(user.id, "set_context", {
        title: "Target",
        content: "body",
      });
      const targetPayload = JSON.parse(target.content[0].text);

      const referrer = await handleContextTool(user.id, "set_context", {
        title: "Referrer",
        content: "See [[Target]].",
      });
      expect(referrer.isError).toBeUndefined();
      const refPayload = JSON.parse(referrer.content[0].text);
      // Typed edges live in the ContextLink table and are visible via
      // incomingLinks / outgoingLinks on get_context.
      const outgoing = refPayload.outgoingLinks ?? [];
      expect(outgoing.length).toBe(1);
      expect(outgoing[0].toEntry?.id ?? outgoing[0].toEntryId).toBe(
        targetPayload.id,
      );
      expect(outgoing[0].type).toBe("REFERENCES");
    });

    it("get_context returns isError for a non-existent id", async () => {
      const result = await handleContextTool(user.id, "get_context", {
        id: "ghost-id",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Context entry not found");
    });
  });

  describe("handleTodoTool", () => {
    it("create_todo returns a parseable JSON payload on success", async () => {
      const result = await handleTodoTool(user.id, "create_todo", {
        title: "MCP Todo",
        priority: "HIGH",
      });
      expect(result.isError).toBeUndefined();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.title).toBe("MCP Todo");
      expect(payload.priority).toBe("HIGH");
    });

    it("create_todo returns isError on invalid priority", async () => {
      const result = await handleTodoTool(user.id, "create_todo", {
        title: "Bad priority",
        priority: "URGENT",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("handleDashboardTool", () => {
    it("get_dashboard returns a formatted markdown + embedded raw JSON payload", async () => {
      const result = await handleDashboardTool(user.id, "get_dashboard", {});
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("## Dashboard Summary");
      expect(text).toContain("### This Week's Focus");
      expect(text).toContain("### Stats");
      // The handler embeds the raw JSON after a `---\nRaw data:\n`
      // marker. Extract it and make sure it parses and has the right
      // top-level shape.
      const marker = "---\nRaw data:\n";
      const idx = text.indexOf(marker);
      expect(idx).toBeGreaterThan(-1);
      const jsonBlob = text.slice(idx + marker.length);
      const payload = JSON.parse(jsonBlob);
      expect(payload).toHaveProperty("weeklyFocus");
      expect(payload).toHaveProperty("progressOverview");
      expect(payload).toHaveProperty("streaksStats");
      expect(payload).toHaveProperty("upcomingDeadlines");
    });
  });
});
