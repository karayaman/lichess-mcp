import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z, ZodError } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { LichessApiError } from "./http/errors.js";
import {
  AnyToolDefinition,
  ToolContext,
  ToolResult,
  isUiResult,
} from "./registry.js";
import { allTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { readUiHtml } from "./ui-loader.js";
import { UI_META_KEY } from "./types/ui-props.js";

export function buildServer(ctx: ToolContext): McpServer {
  const mcp = new McpServer({ name: "lichess-mcp", version: "0.2.0" });

  // De-dupe resource registrations across multiple tools that share a UI.
  const registeredResources = new Set<string>();

  for (const t of allTools) {
    if (t.ui) {
      const ui = t.ui;
      const uiMeta: { resourceUri?: string; visibility?: typeof ui.visibility } = {};
      if (ui.resourceUri) uiMeta.resourceUri = ui.resourceUri;
      if (ui.visibility) uiMeta.visibility = ui.visibility;

      registerAppTool(
        mcp,
        t.name,
        {
          description: t.description,
          inputSchema: t.schema.shape,
          _meta: { ui: uiMeta },
        },
        async (args: unknown) => runTool(t, args, ctx),
      );

      if (ui.resourceUri && ui.htmlFile && !registeredResources.has(ui.resourceUri)) {
        const resourceUri = ui.resourceUri;
        const htmlFile = ui.htmlFile;
        registeredResources.add(resourceUri);
        registerAppResource(
          mcp,
          `${t.name} UI`,
          resourceUri,
          {},
          async () => ({
            contents: [
              {
                uri: resourceUri,
                mimeType: RESOURCE_MIME_TYPE,
                text: readUiHtml(htmlFile),
                ...(ui.csp ? { _meta: { ui: { csp: ui.csp } } } : {}),
              },
            ],
          }),
        );
      }
    } else {
      mcp.registerTool(
        t.name,
        { description: t.description, inputSchema: t.schema.shape },
        async (args: unknown) => runTool(t, args, ctx),
      );
    }
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
  if (isUiResult(value)) {
    return {
      content: [{ type: "text", text: value.text }],
      _meta: { [UI_META_KEY]: { props: value.props } },
    };
  }
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
