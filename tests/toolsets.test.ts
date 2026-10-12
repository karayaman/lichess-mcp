import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  allTools,
  CORE_TOOLSETS,
  TOOLSETS,
  TOOLSET_DESCRIPTIONS,
  selectTools,
} from "../src/tools/index.js";
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
    expect(names(tools)).toEqual(names([...TOOLSETS.tv, { name: "enable_toolset" }]));

    await client.close();
  });

  it("exposes every tool when buildServer is given no selection", async () => {
    const server = buildServer(makeContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(names(tools)).toEqual(names([...allTools, { name: "enable_toolset" }]));

    await client.close();
  });
});

/** Connects a client to a server started with the given tools. */
async function connect(tools: typeof allTools) {
  const server = buildServer(makeContext(), tools);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const text = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as { type: string; text: string }[]).map((c) => c.text).join("\n");

describe("enable_toolset", () => {
  it("describes every toolset in one line", () => {
    expect(Object.keys(TOOLSET_DESCRIPTIONS).sort()).toEqual(Object.keys(TOOLSETS).sort());
    for (const [name, line] of Object.entries(TOOLSET_DESCRIPTIONS)) {
      expect(line, name).toMatch(/^[^\n]{10,120}$/);
    }
  });

  it("is always registered, and its description lists the toolsets that are off", async () => {
    const client = await connect(selectTools(undefined));
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "enable_toolset");
    expect(tool).toBeDefined();
    for (const name of ["arena", "swiss", "bot", "broadcasts"]) {
      expect(tool!.description).toContain(`\n- ${name}: ${TOOLSET_DESCRIPTIONS[name]}`);
    }
    for (const name of CORE_TOOLSETS) {
      expect(tool!.description).not.toContain(`\n- ${name}: `);
    }
    await client.close();
  });

  it("only changes this server's tool list, never Lichess", async () => {
    const client = await connect(selectTools(undefined));
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "enable_toolset")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
    await client.close();
  });

  it("adds a toolset's tools mid-session and tells the client the list changed", async () => {
    const client = await connect(selectTools(undefined));
    let changed = 0;
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      changed++;
    });

    const result = await client.callTool({ name: "enable_toolset", arguments: { toolsets: ["arena"] } });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("create_arena");

    const { tools } = await client.listTools();
    expect(names(tools)).toEqual(
      names([...selectTools("core,arena"), { name: "enable_toolset" }]),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(changed).toBeGreaterThan(0);
    await client.close();
  });

  it("accepts several toolsets, and 'all'", async () => {
    const client = await connect(selectTools("tv"));
    await client.callTool({ name: "enable_toolset", arguments: { toolsets: ["swiss", "teams"] } });
    expect(names((await client.listTools()).tools)).toEqual(
      names([...selectTools("tv,swiss,teams"), { name: "enable_toolset" }]),
    );
    await client.callTool({ name: "enable_toolset", arguments: { toolsets: ["all"] } });
    expect(names((await client.listTools()).tools)).toEqual(
      names([...allTools, { name: "enable_toolset" }]),
    );
    await client.close();
  });

  it("does nothing for a toolset that's already on", async () => {
    const client = await connect(selectTools(undefined));
    const before = names((await client.listTools()).tools);
    const result = await client.callTool({ name: "enable_toolset", arguments: { toolsets: ["games"] } });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toMatch(/already/i);
    expect(names((await client.listTools()).tools)).toEqual(before);
    await client.close();
  });

  it("rejects an unknown toolset and adds nothing", async () => {
    const client = await connect(selectTools(undefined));
    const before = names((await client.listTools()).tools);
    const result = await client.callTool({
      name: "enable_toolset",
      arguments: { toolsets: ["arena", "arenas"] },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/arenas.*arena/s);
    expect(names((await client.listTools()).tools)).toEqual(before);
    await client.close();
  });

  it("serves the UI for a toolset that's enabled later", async () => {
    // The resources capability can't be added after connecting, so UI
    // resources are served from the start, whichever toolsets are on.
    const client = await connect(selectTools("tv"));
    const appTools = TOOLSETS.apps.filter((t) => t.ui?.resourceUri);
    const uris = (await client.listResources()).resources.map((r) => r.uri);
    for (const t of appTools) expect(uris).toContain(t.ui!.resourceUri);

    const result = await client.callTool({ name: "enable_toolset", arguments: { toolsets: ["apps"] } });
    expect(result.isError).toBeFalsy();
    const { tools } = await client.listTools();
    for (const t of appTools) {
      expect(tools.find((x) => x.name === t.name)?._meta).toMatchObject({
        ui: { resourceUri: t.ui!.resourceUri },
      });
    }
    await client.close();
  });
});
