import { vi, expect, type MockInstance } from "vitest";
import { TokenStore } from "../../src/http/token-store.js";
import { LichessClient } from "../../src/http/client.js";
import { allTools } from "../../src/tools/index.js";
import type { ToolContext, AnyToolDefinition } from "../../src/registry.js";

const DEFAULT_TOKEN = "test-token";
const BASE_URL = "https://lichess.org/api";

/** A typed fetch mock with helper methods to queue responses. */
export interface FetchMock extends MockInstance {
  respondJson(body: unknown, init?: ResponseInit): void;
  respondText(body: string, init?: ResponseInit): void;
  respondNdjson(items: unknown[]): void;
  respondPgn(pgn: string): void;
  respondStatus(status: number, body?: string): void;
}

function makeResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

/** Installs a vi.stubGlobal fetch mock and returns it with response helpers. */
export function installFetchMock(): FetchMock {
  const spy = vi.fn() as unknown as FetchMock;

  spy.respondJson = (body: unknown, init: ResponseInit = {}) => {
    spy.mockResolvedValueOnce(
      makeResponse(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      }),
    );
  };

  spy.respondText = (body: string, init: ResponseInit = {}) => {
    spy.mockResolvedValueOnce(makeResponse(body, init));
  };

  spy.respondNdjson = (items: unknown[]) => {
    const body = items.map((i) => JSON.stringify(i)).join("\n");
    spy.mockResolvedValueOnce(
      makeResponse(body, {
        headers: { "content-type": "application/x-ndjson" },
      }),
    );
  };

  spy.respondPgn = (pgn: string) => {
    spy.mockResolvedValueOnce(
      makeResponse(pgn, {
        headers: { "content-type": "application/x-chess-pgn" },
      }),
    );
  };

  spy.respondStatus = (status: number, body = "") => {
    spy.mockResolvedValueOnce(new Response(body, { status }));
  };

  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Creates a fresh ToolContext for tests. */
export function makeContext(opts: { token?: string } = {}): ToolContext {
  const tokens = new TokenStore(opts.token ?? DEFAULT_TOKEN);
  const client = new LichessClient(tokens);
  return { client, tokens };
}

/** Finds a registered tool by name or throws. */
export function findTool(name: string): AnyToolDefinition {
  const t = allTools.find((t) => t.name === name);
  if (!t) throw new Error(`Tool "${name}" not found in registry`);
  return t;
}

/** Asserts a single fetch call was made with the expected shape. */
export function expectFetch(
  spy: MockInstance,
  expected: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    bodyContains?: string;
  },
): void {
  expect(spy).toHaveBeenCalledOnce();
  const [url, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
  expect(url).toBe(expected.url);
  expect((init.method ?? "GET").toUpperCase()).toBe(expected.method.toUpperCase());
  if (expected.headers) {
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers as HeadersInit);
    for (const [key, value] of Object.entries(expected.headers)) {
      expect(headers.get(key)).toBe(value);
    }
  }
  if (expected.bodyContains !== undefined) {
    const body = typeof init.body === "string" ? init.body : String(init.body ?? "");
    expect(body).toContain(expected.bodyContains);
  }
}

/** Convenience: build the full API URL. */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/** Convenience: build a non-api URL (e.g., for /game/export). */
export function lichessUrl(path: string): string {
  return `https://lichess.org${path}`;
}
