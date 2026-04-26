import { z, ZodObject, ZodRawShape } from "zod";
import { LichessClient } from "./http/client.js";
import { TokenStore } from "./http/token-store.js";

export interface ToolContext {
  client: LichessClient;
  tokens: TokenStore;
}

/**
 * Tools return either a string (rendered as plain text) or any JSON-serializable
 * value (rendered via JSON.stringify). The dispatcher in server.ts wraps the
 * return value into the MCP `CallToolResult` shape.
 */
export type ToolResult = string | object;

export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  /** Object-shape schema. The shape is what gets passed to MCP for validation. */
  schema: ZodObject<S>;
  handler: (args: z.infer<ZodObject<S>>, ctx: ToolContext) => Promise<ToolResult>;
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
