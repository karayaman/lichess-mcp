import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

describe("LichessClient retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function status(code: number, headers: Record<string, string> = {}) {
    return new Response("", { status: code, headers });
  }

  /** fetch mock that returns each response in turn, then repeats the last one. */
  function fetchSequence(...responses: Array<() => Response>) {
    let i = 0;
    const spy = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]());
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  it("waits 10 seconds after a 429 before retrying", async () => {
    const spy = fetchSequence(() => status(429), () => ok({ ok: true }));
    const done = makeClient().request("/account");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await done).ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("doubles the 429 wait (10, 20, 40, 80 s), then gives up within 3 minutes", async () => {
    const spy = fetchSequence(() => status(429));
    const done = makeClient().request("/account");
    const outcome = done.then(() => "resolved", (e: unknown) => e);
    const calls: number[] = [];
    for (const wait of [10_000, 20_000, 40_000, 80_000]) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      calls.push(spy.mock.calls.length);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(calls).toEqual([1, 2, 3, 4]);
    const error = await outcome;
    expect(error).toBeInstanceOf(LichessApiError);
    expect((error as LichessApiError).status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it("retries a POST after 429, since Lichess did not process it", async () => {
    const spy = fetchSequence(() => status(429), () => ok({ ok: true }));
    const done = makeClient().postForm("/challenge/alice", { rated: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await done).ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("honors a Retry-After longer than the scheduled wait", async () => {
    const spy = fetchSequence(() => status(429, { "retry-after": "30" }), () => ok({ ok: true }));
    const done = makeClient().request("/account");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await done).ok).toBe(true);
  });

  it("gives up at once when Retry-After is beyond the 3-minute budget", async () => {
    const spy = fetchSequence(() => status(429, { "retry-after": "600" }));
    await expect(makeClient().request("/account")).rejects.toBeInstanceOf(LichessApiError);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries a GET after 503", async () => {
    const spy = fetchSequence(() => status(503), () => ok({ ok: true }));
    const done = makeClient().request("/account");
    await vi.runAllTimersAsync();
    expect((await done).ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a POST after 503, which may have been processed", async () => {
    const spy = fetchSequence(() => status(503), () => ok({ ok: true }));
    await expect(makeClient().postForm("/inbox/alice", { text: "hi" })).rejects.toBeInstanceOf(
      LichessApiError,
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
