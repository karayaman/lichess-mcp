import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodError } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { LichessApiError } from "./http/errors.js";
import { AnyToolDefinition, ToolContext, ToolResult } from "./registry.js";
import { allTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";

export function buildServer(ctx: ToolContext): McpServer {
  const mcp = new McpServer({ name: "lichess-mcp", version: "0.2.0" });

  for (const t of allTools) {
    mcp.registerTool(
      t.name,
      { description: t.description, inputSchema: t.schema.shape },
      async (args: unknown) => runTool(t, args, ctx),
    );
  }

  registerPrompts(mcp);
  return mcp;
}

export async function runTool(
  definition: AnyToolDefinition,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<CallToolResult> {
  let parsedArgs: unknown;
  try {
    parsedArgs = definition.schema.parse(rawArgs ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      return errorResult(`Invalid arguments for ${definition.name}: ${issues}`);
    }
    throw error;
  }

  try {
    const result = await definition.handler(parsedArgs as never, ctx);
    return successResult(result);
  } catch (error) {
    if (error instanceof LichessApiError) {
      return errorResult(`Lichess: ${error.message}`);
    }
    if (error instanceof Error) {
      return errorResult(error.message);
    }
    return errorResult(String(error));
  }
}

function successResult(value: ToolResult): CallToolResult {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
