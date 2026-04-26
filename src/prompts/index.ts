import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "analyze_position",
    {
      title: "Analyze Position",
      description: "Analyze the current chess position",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Please analyze the current chess position and suggest the best moves for both sides. Consider:\n" +
              "1. Material balance\n" +
              "2. Piece activity\n" +
              "3. King safety\n" +
              "4. Pawn structure\n" +
              "5. Tactical opportunities",
          },
        },
      ],
    }),
  );
}
