import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "../src/prompts/index.js";

describe("registerPrompts", () => {
  it("registers the analyze_position prompt without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerPrompts(server)).not.toThrow();
  });

  it("prompt callback returns a message with chess analysis text", () => {
    let capturedCallback: (() => unknown) | undefined;
    const server = {
      registerPrompt: (_name: string, _meta: unknown, cb: () => unknown) => {
        capturedCallback = cb;
      },
    } as unknown as McpServer;

    registerPrompts(server);
    expect(capturedCallback).toBeDefined();

    const result = capturedCallback!() as { messages: Array<{ content: { text: string } }> };
    expect(result.messages[0].content.text).toContain("Material balance");
  });
});
