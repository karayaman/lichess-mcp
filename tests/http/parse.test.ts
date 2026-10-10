import { describe, it, expect } from "vitest";
import { parsePgnOrJson, readFirstNdjsonLine } from "../../src/http/parse.js";

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

/** A body that emits the given chunks and then stays open forever, like a Lichess stream. */
function openStream(chunks: string[]): { body: ReadableStream<Uint8Array>; cancelled: () => boolean } {
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      // Never close: the server keeps the connection open.
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, cancelled: () => cancelled };
}

describe("readFirstNdjsonLine", () => {
  it("returns the first object from a stream that never closes, then cancels it", async () => {
    const stream = openStream(['{"t":"featured"}\n{"t":"fen"}\n']);
    const result = await readFirstNdjsonLine(new Response(stream.body));
    expect(result).toEqual({ t: "featured" });
    expect(stream.cancelled()).toBe(true);
  });

  it("skips keep-alive blank lines", async () => {
    const stream = openStream(["\n", "\n", '{"type":"gameStart"}\n']);
    expect(await readFirstNdjsonLine(new Response(stream.body))).toEqual({ type: "gameStart" });
  });

  it("joins a line split across chunks", async () => {
    const stream = openStream(['{"type":"ga', 'meFull"}\n']);
    expect(await readFirstNdjsonLine(new Response(stream.body))).toEqual({ type: "gameFull" });
  });

  it("parses a final line with no trailing newline when the body closes", async () => {
    expect(await readFirstNdjsonLine(new Response('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns null for an empty body", async () => {
    expect(await readFirstNdjsonLine(new Response(""))).toBeNull();
  });

  it("returns null and cancels the stream when nothing arrives before the timeout", async () => {
    const stream = openStream(["\n"]);
    const result = await readFirstNdjsonLine(new Response(stream.body), 20);
    expect(result).toBeNull();
    expect(stream.cancelled()).toBe(true);
  });
});
