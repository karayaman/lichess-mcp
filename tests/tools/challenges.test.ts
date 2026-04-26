import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
} from "../helpers/mock.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("list_challenges", () => {
  it("GETs /api/challenge", async () => {
    const mock = installFetchMock();
    mock.respondJson({ in: [], out: [] });

    await findTool("list_challenges").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/challenge") });
  });
});

describe("create_challenge", () => {
  it("POSTs form data to /api/challenge/{username}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ challenge: { url: "https://lichess.org/abc" } });

    await findTool("create_challenge").handler(
      {
        username: "alice",
        clock: { limit: 5, increment: 3 },
        variant: "standard",
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/challenge/alice"));
    expect(init.method).toBe("POST");
    // clock limit is converted from minutes to seconds
    expect(init.body?.toString()).toContain("clock.limit=300");
  });
});

describe("accept_challenge", () => {
  it("POSTs to /api/challenge/{id}/accept", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("accept_challenge").handler({ challengeId: "abc123" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/challenge/abc123/accept") });
  });
});

describe("decline_challenge", () => {
  it("POSTs JSON to /api/challenge/{id}/decline", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("decline_challenge").handler(
      { challengeId: "abc123", reason: "tooFast" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/challenge/abc123/decline"));
    expect(init.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.reason).toBe("tooFast");
  });
});

describe("cancel_challenge", () => {
  it("POSTs to /api/challenge/{id}/cancel", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("cancel_challenge").handler({ challengeId: "abc123" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/challenge/abc123/cancel") });
  });
});

describe("get_challenge", () => {
  it("GETs /api/challenge/{id}/show", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "abc123" });

    await findTool("get_challenge").handler({ challengeId: "abc123" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/challenge/abc123/show") });
  });
});

describe("challenge_ai", () => {
  it("POSTs form data to /api/challenge/ai", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "gameId" });

    await findTool("challenge_ai").handler(
      { level: 5, clock: { limit: 300, increment: 0 }, color: "white", variant: "standard" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/challenge/ai"));
    expect(init.method).toBe("POST");
    const body = init.body?.toString() ?? "";
    expect(body).toContain("level=5");
    expect(body).toContain("clock.limit=300");
  });

  it("rejects level outside 1-8 (schema validation)", () => {
    expect(() => findTool("challenge_ai").schema.parse({ level: 0 })).toThrow();
    expect(() => findTool("challenge_ai").schema.parse({ level: 9 })).toThrow();
  });
});

describe("create_open_challenge", () => {
  it("POSTs form data to /api/challenge/open", async () => {
    const mock = installFetchMock();
    mock.respondJson({ challenge: { id: "open1" } });

    await findTool("create_open_challenge").handler(
      { rated: false, clock: { limit: 600, increment: 0 }, variant: "standard" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/challenge/open"));
    expect(init.method).toBe("POST");
    const body = init.body?.toString() ?? "";
    expect(body).toContain("clock.limit=600");
  });
});

describe("start_challenge_clocks", () => {
  it("POSTs to /api/challenge/{gameId}/start-clocks with tokens", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("start_challenge_clocks").handler(
      { gameId: "game1", token1: "tok1", token2: "tok2" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/challenge/game1/start-clocks");
    expect(url).toContain("token1=tok1");
    expect(url).toContain("token2=tok2");
  });
});

describe("add_time_to_game", () => {
  it("POSTs to /api/round/{gameId}/add-time/{seconds}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("add_time_to_game").handler(
      { gameId: "game1", seconds: 15 },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/round/game1/add-time/15"));
    expect(init.method).toBe("POST");
  });
});

describe("admin_challenge_tokens", () => {
  it("POSTs form data to /api/token/admin-challenge", async () => {
    const mock = installFetchMock();
    mock.respondJson({ alice: "token1", bob: "token2" });

    await findTool("admin_challenge_tokens").handler(
      { users: "alice,bob", description: "Test challenge" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/token/admin-challenge"));
    expect(init.body?.toString()).toContain("users=alice%2Cbob");
  });
});
