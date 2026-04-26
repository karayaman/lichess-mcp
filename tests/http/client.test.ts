import { describe, it, expect, beforeEach, vi } from "vitest";
import { LichessClient } from "../../src/http/client.js";
import { TokenStore } from "../../src/http/token-store.js";
import { LichessApiError } from "../../src/http/errors.js";
import { LichessTokenMissingError } from "../../src/http/token-store.js";

function makeClient(token = "test-token") {
  return new LichessClient(new TokenStore(token));
}

function mockFetch(response: Response) {
  const spy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function ok(body: unknown, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("LichessClient.request", () => {
  it("includes Bearer token in Authorization header", async () => {
    const spy = mockFetch(ok({}));
    await makeClient("my-token").request("/account");
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get("Authorization")).toBe("Bearer my-token");
  });

  it("omits Authorization header when auth=false", async () => {
    const spy = mockFetch(ok({}));
    await makeClient().request("/token/test", { auth: false });
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("uses custom baseUrl when provided", async () => {
    const spy = mockFetch(ok({}));
    await makeClient().request("/query", { baseUrl: "https://explorer.lichess.ovh" });
    expect(spy.mock.calls[0][0]).toBe("https://explorer.lichess.ovh/query");
  });

  it("throws LichessApiError on non-ok response", async () => {
    mockFetch(new Response('{"error":"Not found"}', { status: 404 }));
    await expect(makeClient().request("/missing")).rejects.toBeInstanceOf(LichessApiError);
  });

  it("retries on 429 and succeeds on second attempt (exponential backoff)", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(ok({ ok: true }));
    vi.stubGlobal("fetch", spy);
    const response = await makeClient().request("/account");
    expect(response.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("uses Retry-After header value as backoff when present", async () => {
    const retryResponse = new Response("", {
      status: 429,
      headers: { "retry-after": "0.001" },
    });
    const spy = vi
      .fn()
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(ok({ ok: true }));
    vi.stubGlobal("fetch", spy);
    const response = await makeClient().request("/account");
    expect(response.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("throws LichessTokenMissingError when no token set", async () => {
    const client = new LichessClient(new TokenStore(undefined));
    await expect(client.request("/account")).rejects.toBeInstanceOf(LichessTokenMissingError);
  });
});

describe("LichessClient helper methods", () => {
  it("get() parses JSON response", async () => {
    mockFetch(ok({ id: "thibault" }));
    const result = await makeClient().get<{ id: string }>("/user/thibault");
    expect(result).toEqual({ id: "thibault" });
  });

  it("ndjson() parses multi-line JSON", async () => {
    const body = '{"id":"a"}\n{"id":"b"}\n';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const result = await makeClient().ndjson<{ id: string }>("/rel/following");
    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("pgn() sends Accept: application/x-chess-pgn", async () => {
    const spy = vi.fn().mockResolvedValue(
      new Response("[Event ?]\n", {
        status: 200,
        headers: { "content-type": "application/x-chess-pgn" },
      }),
    );
    vi.stubGlobal("fetch", spy);
    const result = await makeClient().pgn("/game/export/abc12345");
    expect(result).toContain("[Event ?]");
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
  });

  it("postForm() sets application/x-www-form-urlencoded content-type", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await makeClient().postForm("/inbox/someone", { text: "hello" });
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("text=hello");
  });

  it("postForm() skips null field values", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await makeClient().postForm("/path", { keep: "yes", skip: null });
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.body?.toString()).toContain("keep=yes");
    expect(init.body?.toString()).not.toContain("skip");
  });

  it("postJson() sets application/json content-type", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await makeClient().postJson("/challenge/user/decline", { reason: "generic" });
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "generic" });
  });

  it("delete() sends DELETE method", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await makeClient().delete("/token");
    const [, init] = spy.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.method).toBe("DELETE");
  });
});

describe("LichessApiError", () => {
  it("extracts error message from JSON body", async () => {
    const response = new Response('{"error":"Not found"}', { status: 404 });
    const err = await LichessApiError.fromResponse(response);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
  });

  it("falls back to status message when body is not JSON", async () => {
    const response = new Response("plain error", { status: 403 });
    const err = await LichessApiError.fromResponse(response);
    expect(err.message).toBe("Forbidden — your token lacks the required scope");
    expect(err.status).toBe(403);
  });

  it("uses message field from JSON body when error field is absent", async () => {
    const response = new Response('{"message":"Custom message"}', { status: 400 });
    const err = await LichessApiError.fromResponse(response);
    expect(err.message).toBe("Custom message");
  });

  it("falls back to HTTP {status} when status is unknown and no body detail", async () => {
    const err = new LichessApiError(418);
    expect(err.message).toBe("HTTP 418");
  });

  it("uses response.statusText when status is not in map", async () => {
    const response = new Response("", { status: 418, statusText: "I'm a teapot" });
    const err = await LichessApiError.fromResponse(response);
    expect(err.message).toBe("I'm a teapot");
  });
});
