import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { buildServer, runTool } from "../src/server.js";
import { LichessApiError } from "../src/http/errors.js";
import { makeContext } from "./helpers/mock.js";
import type { AnyToolDefinition } from "../src/registry.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── buildServer ──────────────────────────────────────────────────────────────

describe("buildServer", () => {
  it("returns an McpServer instance without throwing", () => {
    const ctx = makeContext();
    const server = buildServer(ctx);
    expect(server).toBeDefined();
  });
});

// ─── runTool – success paths ──────────────────────────────────────────────────

describe("runTool – success", () => {
  it("uses empty object when rawArgs is null/undefined", async () => {
    const def: AnyToolDefinition = {
      name: "test_null_args",
      description: "test",
      schema: z.object({}),
      handler: async () => "ok",
    };
    const result = await runTool(def, null, makeContext());
    expect(result.isError).toBeFalsy();
  });

  it("wraps a string handler result into a text content block", async () => {
    const def: AnyToolDefinition = {
      name: "test_string",
      description: "test",
      schema: z.object({}),
      handler: async () => "hello",
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toMatchObject({ type: "text", text: "hello" });
  });

  it("JSON-stringifies an object handler result", async () => {
    const def: AnyToolDefinition = {
      name: "test_object",
      description: "test",
      schema: z.object({}),
      handler: async () => ({ id: "abc" }),
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual({ id: "abc" });
  });
});

// ─── runTool – Zod validation error ──────────────────────────────────────────

describe("runTool – Zod validation error", () => {
  it("returns isError result with field path on invalid args", async () => {
    const def: AnyToolDefinition = {
      name: "test_zod",
      description: "test",
      schema: z.object({ name: z.string().min(1) }),
      handler: async () => "ok",
    };
    const result = await runTool(def, { name: "" }, makeContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid arguments");
    expect(result.content[0].text).toContain("name");
  });

  it("uses (root) path when error has no path", async () => {
    const def: AnyToolDefinition = {
      name: "test_root",
      description: "test",
      schema: z.object({}).refine(() => false, "root-level failure"),
      handler: async () => "ok",
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("(root)");
  });

  it("re-throws non-Zod errors thrown during schema parsing", async () => {
    const def: AnyToolDefinition = {
      name: "test_rethrow",
      description: "test",
      schema: {
        parse: () => { throw new TypeError("boom"); },
        shape: {},
      } as unknown as z.ZodObject<z.ZodRawShape>,
      handler: async () => "ok",
    };
    await expect(runTool(def, {}, makeContext())).rejects.toThrow("boom");
  });
});

// ─── runTool – handler error paths ───────────────────────────────────────────

describe("runTool – handler errors", () => {
  it("converts LichessApiError to an isError result prefixed with 'Lichess:'", async () => {
    const def: AnyToolDefinition = {
      name: "test_lichess_err",
      description: "test",
      schema: z.object({}),
      handler: async () => { throw new LichessApiError(404, "Not found"); },
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Lichess: Not found");
  });

  it("converts a generic Error to an isError result", async () => {
    const def: AnyToolDefinition = {
      name: "test_generic_err",
      description: "test",
      schema: z.object({}),
      handler: async () => { throw new Error("something broke"); },
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("something broke");
  });

  it("converts a non-Error thrown value to a string isError result", async () => {
    const def: AnyToolDefinition = {
      name: "test_non_error",
      description: "test",
      schema: z.object({}),
      handler: async () => { throw "raw string thrown"; },
    };
    const result = await runTool(def, {}, makeContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("raw string thrown");
  });
});
