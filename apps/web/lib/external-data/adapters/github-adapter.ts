/**
 * Wave 10: GitHub adapter for EXTERNAL_DATABASE entries.
 *
 * Surfaces Issues + Pull Requests as read-only virtual database rows
 * keyed by GitHub's `node_id`. Repos shape is a stretch goal: ships a
 * field schema but the query path returns an empty page until the
 * actual implementation lands (caller logs a "not implemented yet"
 * warning).
 *
 * All HTTP calls use `globalThis.fetch` (Node 22 native). Auth via
 * the user's PAT from `ExternalDataSource.encryptedCredentials` (the
 * service decrypts before instantiating the adapter).
 *
 * Rate-limit handling: read `X-RateLimit-Remaining` from every
 * response. If < 5, return `{ rows: [], nextCursor: null,
 * rateLimited: true }` so the UI can show a friendly banner.
 */

import type {
  ExternalDataAdapter,
  ExternalDataField,
  ExternalDataQueryResult,
  ExternalDataRow,
  ExternalDataShape,
} from "@ascend/core";
import type { GithubConfig } from "@/lib/validations";

const API_BASE = "https://api.github.com";
const GITHUB_REST_API_VERSION = "2022-11-28";
const DEFAULT_PER_PAGE = 25;

interface GithubAdapterArgs {
  pat: string;
  config: GithubConfig;
}

interface GithubLink {
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

function parseLinkHeader(link: string | null): GithubLink {
  if (!link) return {};
  const out: GithubLink = {};
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (!match) continue;
    const [, url, rel] = match;
    if (rel === "next" || rel === "prev" || rel === "first" || rel === "last") {
      out[rel] = url;
    }
  }
  return out;
}

/** GitHub Issue/PR labels can have arbitrary names; we normalize to
 * SELECT options with a stable hex color. */
function labelsToOptions(
  labels: Array<{ name?: string; color?: string }>,
): Array<{ value: string; label: string; color?: string }> {
  return labels
    .filter((l) => typeof l.name === "string")
    .map((l) => ({
      value: l.name!,
      label: l.name!,
      color: l.color ? `#${l.color}` : undefined,
    }));
}

export function createGithubAdapter(args: GithubAdapterArgs): ExternalDataAdapter {
  const { pat, config: _config } = args;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
    "User-Agent": "Ascend-Wave10/1.0",
  };

  async function ghFetch(
    url: string,
  ): Promise<{
    ok: true;
    response: Response;
    data: unknown;
  } | { ok: false; error: string; rateLimited?: boolean }> {
    try {
      const res = await globalThis.fetch(url, { headers });
      const remaining = parseInt(
        res.headers.get("X-RateLimit-Remaining") ?? "999",
        10,
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `GitHub ${res.status} ${res.statusText}`,
          rateLimited: res.status === 403 && remaining === 0,
        };
      }
      if (remaining < 5) {
        return { ok: false, error: "GitHub rate limit nearly exhausted", rateLimited: true };
      }
      const data = await res.json();
      return { ok: true, response: res, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Shapes ──────────────────────────────────────────────────────

  const shapes: ExternalDataShape[] = [
    { id: "issues", label: "Issues", description: "GitHub Issues." },
    { id: "pulls", label: "Pull requests", description: "GitHub Pull Requests." },
    { id: "repos", label: "Repositories", description: "Browse-only list of your repos." },
  ];

  // ── Field schemas ───────────────────────────────────────────────

  const ISSUE_SCHEMA: ExternalDataField[] = [
    { id: "title", label: "Title", type: "TEXT", isPrimary: true, searchable: true, sortable: true },
    { id: "number", label: "#", type: "NUMBER", filterable: true, sortable: true },
    {
      id: "state",
      label: "State",
      type: "SELECT",
      filterable: true,
      sortable: true,
      options: [
        { value: "open", label: "Open", color: "#22c55e" },
        { value: "closed", label: "Closed", color: "#9333ea" },
      ],
    },
    { id: "author", label: "Author", type: "USER", filterable: true },
    { id: "assignees", label: "Assignees", type: "MULTI_SELECT", filterable: true },
    { id: "labels", label: "Labels", type: "MULTI_SELECT", filterable: true },
    { id: "milestone", label: "Milestone", type: "SELECT", filterable: true },
    { id: "commentsCount", label: "Comments", type: "NUMBER", sortable: true },
    { id: "createdAt", label: "Created", type: "DATE", filterable: true, sortable: true },
    { id: "updatedAt", label: "Updated", type: "DATE", filterable: true, sortable: true },
    { id: "closedAt", label: "Closed at", type: "DATE", filterable: true, sortable: true },
    { id: "htmlUrl", label: "URL", type: "URL" },
    { id: "repo", label: "Repository", type: "TEXT", filterable: true, sortable: true },
  ];

  const PR_SCHEMA: ExternalDataField[] = [
    { id: "title", label: "Title", type: "TEXT", isPrimary: true, searchable: true, sortable: true },
    { id: "number", label: "#", type: "NUMBER", filterable: true, sortable: true },
    {
      id: "state",
      label: "State",
      type: "SELECT",
      filterable: true,
      sortable: true,
      options: [
        { value: "open", label: "Open", color: "#22c55e" },
        { value: "closed", label: "Closed", color: "#9333ea" },
        { value: "merged", label: "Merged", color: "#3b82f6" },
      ],
    },
    {
      id: "draft",
      label: "Draft",
      type: "CHECKBOX",
      filterable: true,
    },
    { id: "author", label: "Author", type: "USER", filterable: true },
    { id: "baseRef", label: "Base", type: "TEXT", filterable: true },
    { id: "headRef", label: "Head", type: "TEXT", filterable: true },
    { id: "mergedAt", label: "Merged at", type: "DATE", filterable: true, sortable: true },
    { id: "closedAt", label: "Closed at", type: "DATE", filterable: true, sortable: true },
    { id: "createdAt", label: "Created", type: "DATE", filterable: true, sortable: true },
    { id: "updatedAt", label: "Updated", type: "DATE", filterable: true, sortable: true },
    { id: "commentsCount", label: "Comments", type: "NUMBER", sortable: true },
    { id: "additions", label: "Additions", type: "NUMBER", sortable: true },
    { id: "deletions", label: "Deletions", type: "NUMBER", sortable: true },
    { id: "htmlUrl", label: "URL", type: "URL" },
    { id: "repo", label: "Repository", type: "TEXT", filterable: true, sortable: true },
  ];

  const REPO_SCHEMA: ExternalDataField[] = [
    { id: "fullName", label: "Name", type: "TEXT", isPrimary: true, searchable: true, sortable: true },
    { id: "description", label: "Description", type: "TEXT", searchable: true },
    { id: "language", label: "Language", type: "SELECT", filterable: true, sortable: true },
    { id: "stars", label: "Stars", type: "NUMBER", sortable: true },
    {
      id: "private",
      label: "Private",
      type: "CHECKBOX",
      filterable: true,
    },
    { id: "pushedAt", label: "Last push", type: "DATE", sortable: true },
    { id: "htmlUrl", label: "URL", type: "URL" },
  ];

  function getSchemaForShape(shape: string): ExternalDataField[] | null {
    switch (shape) {
      case "issues":
        return ISSUE_SCHEMA;
      case "pulls":
        return PR_SCHEMA;
      case "repos":
        return REPO_SCHEMA;
      default:
        return null;
    }
  }

  // ── Row mappers ─────────────────────────────────────────────────

  function mapIssue(raw: unknown): ExternalDataRow | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const repoUrl = typeof r.repository_url === "string" ? r.repository_url : "";
    const repo = repoUrl.replace(/^https:\/\/api\.github\.com\/repos\//, "");
    return {
      remoteId: String(r.node_id ?? r.id ?? ""),
      htmlUrl: typeof r.html_url === "string" ? r.html_url : undefined,
      createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : undefined,
      data: {
        title: r.title,
        number: r.number,
        state: r.state,
        author:
          typeof r.user === "object" && r.user !== null
            ? (r.user as { login?: string }).login
            : null,
        assignees: Array.isArray(r.assignees)
          ? (r.assignees as Array<{ login?: string }>).map((a) => a.login).filter(Boolean)
          : [],
        labels: Array.isArray(r.labels)
          ? (r.labels as Array<{ name?: string }>).map((l) => l.name).filter(Boolean)
          : [],
        milestone:
          typeof r.milestone === "object" && r.milestone !== null
            ? (r.milestone as { title?: string }).title
            : null,
        commentsCount: r.comments,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        closedAt: r.closed_at,
        htmlUrl: r.html_url,
        repo,
      },
    };
  }

  function mapPull(raw: unknown): ExternalDataRow | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const repoUrl = typeof r.base === "object" && r.base !== null
      ? ((r.base as { repo?: { full_name?: string } }).repo?.full_name ?? "")
      : "";
    const merged = !!r.merged_at;
    const stateValue = merged ? "merged" : (r.state as string);
    return {
      remoteId: String(r.node_id ?? r.id ?? ""),
      htmlUrl: typeof r.html_url === "string" ? r.html_url : undefined,
      createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : undefined,
      data: {
        title: r.title,
        number: r.number,
        state: stateValue,
        draft: !!r.draft,
        author:
          typeof r.user === "object" && r.user !== null
            ? (r.user as { login?: string }).login
            : null,
        baseRef:
          typeof r.base === "object" && r.base !== null
            ? (r.base as { ref?: string }).ref
            : null,
        headRef:
          typeof r.head === "object" && r.head !== null
            ? (r.head as { ref?: string }).ref
            : null,
        mergedAt: r.merged_at,
        closedAt: r.closed_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        commentsCount: r.comments,
        additions: r.additions,
        deletions: r.deletions,
        htmlUrl: r.html_url,
        repo: repoUrl,
      },
    };
  }

  function mapRepo(raw: unknown): ExternalDataRow | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    return {
      remoteId: String(r.node_id ?? r.id ?? ""),
      htmlUrl: typeof r.html_url === "string" ? r.html_url : undefined,
      createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : undefined,
      data: {
        fullName: r.full_name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        private: !!r.private,
        pushedAt: r.pushed_at,
        htmlUrl: r.html_url,
      },
    };
  }

  // ── Public adapter API ──────────────────────────────────────────

  return {
    listShapes() {
      return shapes;
    },

    async getSchema(shape: string): Promise<ExternalDataField[]> {
      const schema = getSchemaForShape(shape);
      if (!schema) throw new Error(`Unknown shape: ${shape}`);
      // Future: enrich SELECT options with cached GitHub labels via
      // `/repos/.../labels`. Wave 10 ships with a static schema.
      return schema;
    },

    async query(
      shape: string,
      qargs: {
        filter?: Array<{ field: string; op: string; value?: unknown }>;
        sort?: Array<{ field: string; direction: "asc" | "desc" }>;
        cursor?: string;
        perPage?: number;
      },
    ): Promise<ExternalDataQueryResult> {
      const perPage = qargs.perPage ?? DEFAULT_PER_PAGE;
      const url = qargs.cursor
        ? qargs.cursor
        : buildSearchUrl(shape, qargs.filter ?? [], qargs.sort ?? [], perPage);
      if (!url) {
        // Unknown shape OR repos shape (deferred in W10)
        return { rows: [], nextCursor: null };
      }

      const result = await ghFetch(url);
      if (!result.ok) {
        return {
          rows: [],
          nextCursor: null,
          rateLimited: result.rateLimited,
        };
      }

      const link = parseLinkHeader(result.response.headers.get("Link"));
      const data = result.data as { items?: unknown[]; total_count?: number } | unknown[];

      let items: unknown[] = [];
      let totalCount: number | undefined;
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === "object") {
        items = Array.isArray(data.items) ? data.items : [];
        totalCount = data.total_count;
      }

      const mapper =
        shape === "issues"
          ? mapIssue
          : shape === "pulls"
            ? mapPull
            : shape === "repos"
              ? mapRepo
              : null;
      if (!mapper) return { rows: [], nextCursor: null };

      const rows: ExternalDataRow[] = [];
      for (const item of items) {
        const row = mapper(item);
        if (row) rows.push(row);
      }

      return {
        rows,
        nextCursor: link.next ?? null,
        totalCount,
      };
    },

    async getRow(shape: string, remoteId: string): Promise<ExternalDataRow | null> {
      // Reverse lookup by node_id is not directly supported by REST;
      // we use GraphQL. Defer to Wave 11.
      // For now, return null and let the wikilink resolver fall back.
      void remoteId;
      void shape;
      return null;
    },
  };

  // ── Query URL builder ───────────────────────────────────────────

  function buildSearchUrl(
    shape: string,
    filter: Array<{ field: string; op: string; value?: unknown }>,
    sort: Array<{ field: string; direction: "asc" | "desc" }>,
    perPage: number,
  ): string | null {
    if (shape === "repos") {
      // W10: ship the schema but skip the network call. Adapter caller
      // can show "Repos shape is stretch — not implemented yet."
      // Returning an empty page rather than null keeps the surface
      // navigable.
      // Future: GET /user/repos
      return null;
    }
    if (shape !== "issues" && shape !== "pulls") return null;

    // Use GitHub Search Issues API: covers issues + PRs in one endpoint.
    // q syntax: is:issue/is:pr + filters.
    const qParts: string[] = [];
    qParts.push(shape === "issues" ? "is:issue" : "is:pr");

    for (const clause of filter) {
      const v = clause.value;
      switch (clause.field) {
        case "state":
          if (typeof v === "string" && (v === "open" || v === "closed")) {
            qParts.push(`state:${v}`);
          }
          break;
        case "author":
          if (typeof v === "string") qParts.push(`author:${v}`);
          break;
        case "assignees":
          if (typeof v === "string") qParts.push(`assignee:${v}`);
          break;
        case "labels":
          if (typeof v === "string") qParts.push(`label:"${v}"`);
          break;
        case "milestone":
          if (typeof v === "string") qParts.push(`milestone:"${v}"`);
          break;
        case "repo":
          if (typeof v === "string") qParts.push(`repo:${v}`);
          break;
        case "title":
          if (typeof v === "string" && clause.op === "contains") {
            qParts.push(`"${v}" in:title`);
          }
          break;
      }
    }
    const q = encodeURIComponent(qParts.join(" "));

    // Sort: github search supports created, updated, comments, reactions.
    const sortClause = sort[0];
    let sortParam = "";
    if (sortClause) {
      const fieldMap: Record<string, string> = {
        createdAt: "created",
        updatedAt: "updated",
        commentsCount: "comments",
      };
      const ghField = fieldMap[sortClause.field];
      if (ghField) {
        sortParam = `&sort=${ghField}&order=${sortClause.direction}`;
      }
    }

    return `${API_BASE}/search/issues?q=${q}&per_page=${perPage}${sortParam}`;
  }
}
