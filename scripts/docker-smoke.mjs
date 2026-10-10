#!/usr/bin/env node
// Smoke-tests a built Docker image: starts it as an MCP server over stdio,
// checks it lists tools and serves a bundled UI resource, and checks the
// container does not run as root.
// Usage: node scripts/docker-smoke.mjs <image>
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const image = process.argv[2];
if (!image) {
  console.error("usage: node scripts/docker-smoke.mjs <image>");
  process.exit(2);
}

function check(ok, message) {
  if (!ok) throw new Error(message);
  console.log(`ok - ${message}`);
}

const user = execFileSync("docker", ["run", "--rm", "--entrypoint", "id", image, "-u"], {
  encoding: "utf8",
}).trim();
check(user !== "0", `container runs as a non-root user (uid ${user})`);

const client = new Client({ name: "docker-smoke", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({ command: "docker", args: ["run", "-i", "--rm", image] }),
);
try {
  const { tools } = await client.listTools();
  check(tools.length > 0, `server lists ${tools.length} tools`);

  const uri = "ui://lichess-mcp/puzzle.html";
  const { contents } = await client.readResource({ uri });
  check(/<html/i.test(contents[0]?.text ?? ""), `server serves the bundled UI at ${uri}`);
} finally {
  await client.close();
}
