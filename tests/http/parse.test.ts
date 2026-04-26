import { describe, it, expect } from "vitest";
import { parsePgnOrJson } from "../../src/http/parse.js";

describe("parsePgnOrJson", () => {
  it("returns kind=pgn for application/x-chess-pgn content-type", async () => {
    const response = new Response("[Event ?]\n1. e4", {
      headers: { "content-type": "application/x-chess-pgn" },
    });
    const result = await parsePgnOrJson(response);
    expect(result.kind).toBe("pgn");
    expect((result as { pgn: string }).pgn).toContain("[Event ?]");
  });

  it("returns kind=json for application/json content-type", async () => {
    const response = new Response('{"id":"abc"}', {
      headers: { "content-type": "application/json" },
    });
    const result = await parsePgnOrJson(response);
    expect(result.kind).toBe("json");
    expect((result as { data: unknown }).data).toEqual({ id: "abc" });
  });

  it("uses empty string as content-type fallback when header is absent (null get)", async () => {
    const fakeResponse = {
      headers: { get: () => null },
      json: async () => ({ id: "abc" }),
    } as unknown as Response;
    const result = await parsePgnOrJson(fakeResponse);
    expect(result.kind).toBe("json");
  });
});
