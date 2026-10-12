#!/usr/bin/env node

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TokenStore } from "./http/token-store.js";
import { LichessClient } from "./http/client.js";
import { buildServer } from "./server.js";
import { selectTools } from "./tools/index.js";

const tokens = new TokenStore();
const client = new LichessClient(tokens);
let tools;
try {
  tools = selectTools(process.env.LICHESS_TOOLSETS);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
const server = buildServer({ client, tokens }, tools);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
