import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { makeContext } from "./helpers/mock.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

describe("version", () => {
  it("the server reports the version in package.json", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await buildServer(makeContext()).connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);
    expect(client.getServerVersion()?.version).toBe(pkg.version);
    await client.close();
  });

  it("no source file hard-codes the version", () => {
    for (const file of ["../src/server.ts", "../src/ui/shared/app-bootstrap.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source, file).not.toContain(`"${pkg.version}"`);
    }
  });
});
