import { z, ZodObject, ZodRawShape } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { LichessClient } from "./http/client.js";
import { TokenStore } from "./http/token-store.js";
import { UiToolResult } from "./types/ui-props.js";

/**
 * Mirror of the MCP Apps spec type
 * (`@modelcontextprotocol/ext-apps` `McpUiToolVisibility`). Inlined because the
 * package's root re-export isn't reachable under Node16 module resolution.
 */
export type McpUiToolVisibility = "model" | "app";

export interface ToolContext {
  client: LichessClient;
  tokens: TokenStore;
}

/**
 * Tools return either a string (rendered as plain text), any JSON-serializable
 * value (rendered via JSON.stringify), or a UiToolResult discriminator that
 * carries both a text fallback and structured props for an MCP App iframe.
 * The dispatcher in server.ts unwraps each shape into the MCP `CallToolResult`.
 */
export type ToolResult = string | object | UiToolResult<unknown>;

/**
 * Optional MCP Apps descriptor — a tool with this set is registered via
 * `registerAppTool`, so it carries `_meta.ui` to MCP-Apps-aware clients.
 *
 * Two shapes are supported:
 * - Iframe-bearing tool: set `resourceUri` + `htmlFile` (and optionally `csp`).
 * - App-only callback: omit `resourceUri`/`htmlFile` and set `visibility: ["app"]`
 *   so the tool is invisible to the model and callable only from this server's iframe.
 */
export interface UiAppDescriptor {
  /** Stable URI like "ui://lichess-mcp/puzzle.html". Omit for app-only callback tools. */
  resourceUri?: string;
  /** Filename inside build/ui/ produced by Vite (e.g. "puzzle.html"). Required iff resourceUri is set. */
  htmlFile?: string;
  /** Optional CSP overrides — leave undefined for fully self-contained UIs. */
  csp?: { resourceDomains?: string[]; connectDomains?: string[] };
  /**
   * MCP Apps visibility per spec. Default (omitted) is `["model", "app"]`.
   * Use `["app"]` for iframe-only callbacks the model must not invoke directly.
   */
  visibility?: McpUiToolVisibility[];
}

/**
 * MCP tool annotation presets. Clients may use these hints to decide when to ask
 * the user before running a tool (e.g. auto-approve read-only tools only).
 *
 * - READ_ONLY: changes nothing.
 * - ADDITIVE: creates, joins, sends or moves, but removes nothing.
 * - DESTRUCTIVE: deletes or overwrites existing data, ends or forfeits a game or
 *   event, removes a person or relationship, or cannot be undone.
 *
 * openWorldHint defaults to true, which fits every tool that calls Lichess.
 */
export const READ_ONLY = { readOnlyHint: true } as const satisfies ToolAnnotations;
export const ADDITIVE = { readOnlyHint: false, destructiveHint: false } as const satisfies ToolAnnotations;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const satisfies ToolAnnotations;

export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  /** Safety hints for MCP clients; use READ_ONLY, ADDITIVE or DESTRUCTIVE. */
  annotations: ToolAnnotations;
  /** Object-shape schema. The shape is what gets passed to MCP for validation. */
  schema: ZodObject<S>;
  handler: (args: z.infer<ZodObject<S>>, ctx: ToolContext) => Promise<ToolResult>;
  /** When set, the tool is registered as an MCP App with this UI resource. */
  ui?: UiAppDescriptor;
}

/**
 * Erased tool definition — what the registry array actually stores. The
 * domain-specific types are preserved when authoring a tool via `tool()` but
 * collapse to this shape once added to a heterogeneous list.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any>;

/** Identity helper that preserves the schema's generic so handler args stay typed. */
export function tool<S extends ZodRawShape>(definition: ToolDefinition<S>): ToolDefinition<S> {
  return definition;
}

/** Type guard for handler returns that carry MCP App UI props. */
export function isUiResult(value: unknown): value is UiToolResult<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __uiResult?: unknown }).__uiResult === true
  );
}
