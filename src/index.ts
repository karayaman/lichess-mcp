#!/usr/bin/env node

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TokenStore } from "./http/token-store.js";
import { LichessClient } from "./http/client.js";
import { buildServer } from "./server.js";

const tokens = new TokenStore();
const client = new LichessClient(tokens);
const server = buildServer({ client, tokens });

server.connect(new StdioServerTransport()).catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
