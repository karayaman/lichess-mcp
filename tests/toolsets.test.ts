import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { allTools, CORE_TOOLSETS, TOOLSETS, selectTools } from "../src/tools/index.js";
import { buildServer } from "../src/server.js";
import { makeContext } from "./helpers/mock.js";

const names = (tools: { name: string }[]) => tools.map((t) => t.name).sort();
const toolsIn = (...sets: string[]) => sets.flatMap((s) => TOOLSETS[s]);

/** The tools/list response a client receives, as JSON. */
async function listedTools(tools: typeof allTools): Promise<string> {
  const server = buildServer(makeContext(), tools);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools: listed } = await client.listTools();
  await client.close();
  return JSON.stringify(listed);
}

describe("toolsets", () => {
  it("puts every tool in exactly one toolset", () => {
    const grouped = Object.values(TOOLSETS).flat();
    expect(names(grouped)).toEqual(names(allTools));
  });

  it("enables only the core toolsets by default", () => {
    expect(names(selectTools(undefined))).toEqual(names(toolsIn(...CORE_TOOLSETS)));
    expect(names(selectTools(""))).toEqual(names(toolsIn(...CORE_TOOLSETS)));
  });

  it("keeps everyday tools in core and organizer and bot tools out", () => {
    const core = new Set(names(selectTools(undefined)));
    for (const name of ["get_my_profile", "export_game", "play_puzzle", "view_pgn", "get_cloud_eval"]) {
      expect(core.has(name), `${name} should be in core`).toBe(true);
    }
    for (const name of ["create_arena", "create_swiss", "make_bot_move", "create_bulk_pairing", "create_broadcast_tournament"]) {
      expect(core.has(name), `${name} should not be in core`).toBe(false);
    }
  });

  it("keeps the default tool list small enough to load every session", async () => {
    // Clients send the whole tools/list to the model each session. With every
    // toolset it is about 94,000 characters; core should stay well under half.
    expect((await listedTools(selectTools(undefined))).length).toBeLessThan(40_000);
    expect((await listedTools(allTools)).length).toBeGreaterThan(80_000);
  });

  it("enables everything with 'all'", () => {
    expect(names(selectTools("all"))).toEqual(names(allTools));
  });

  it("adds named toolsets to core", () => {
    expect(names(selectTools("core,arena,swiss"))).toEqual(
      names(toolsIn(...CORE_TOOLSETS, "arena", "swiss")),
    );
  });

  it("enables only the named toolsets when core isn't listed", () => {
    expect(names(selectTools("board,challenges"))).toEqual(names(toolsIn("board", "challenges")));
  });

  it("ignores case, spaces and repeats", () => {
    expect(names(selectTools(" Arena , arena,CORE "))).toEqual(
      names(toolsIn(...CORE_TOOLSETS, "arena")),
    );
  });

  it("rejects an unknown toolset and lists the valid ones", () => {
    expect(() => selectTools("core,arenas")).toThrow(/arenas.*arena/s);
  });

  it("exposes only the selected tools to MCP clients", async () => {
    const server = buildServer(makeContext(), selectTools("tv"));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(names(tools)).toEqual(names(TOOLSETS.tv));

    await client.close();
  });

  it("exposes every tool when buildServer is given no selection", async () => {
    const server = buildServer(makeContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(allTools.length);

    await client.close();
  });
});
