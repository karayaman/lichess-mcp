import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
} from "../helpers/mock.js";
import { LichessApiError } from "../../src/http/errors.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── get_users_status ─────────────────────────────────────────────────────────

describe("get_users_status", () => {
  it("GETs /api/users/status with ids param", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "alice", online: true }]);

    await findTool("get_users_status").handler(
      { ids: "alice,bob" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/users/status");
    expect(url).toContain("ids=alice%2Cbob");
  });

  it("includes optional flags", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_users_status").handler(
      { ids: "alice", withSignal: true, withGameIds: true, withGameMetas: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("withSignal=true");
    expect(url).toContain("withGameIds=true");
    expect(url).toContain("withGameMetas=true");
  });

  it("rejects more than 100 ids (schema validation)", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `user${i}`).join(",");
    expect(() => findTool("get_users_status").schema.parse({ ids })).toThrow();
  });
});

// ─── get_all_top_10 ───────────────────────────────────────────────────────────

describe("get_all_top_10", () => {
  it("GETs /api/player", async () => {
    const mock = installFetchMock();
    mock.respondJson({ bullet: [] });

    await findTool("get_all_top_10").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/player") });
  });
});

// ─── get_leaderboard ──────────────────────────────────────────────────────────

describe("get_leaderboard", () => {
  it("GETs /api/player/top/{nb}/{perfType}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ users: [] });

    await findTool("get_leaderboard").handler(
      { perfType: "blitz", nb: 10 },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/player/top/10/blitz") });
  });

  it("uses default nb=100", async () => {
    const mock = installFetchMock();
    mock.respondJson({ users: [] });

    await findTool("get_leaderboard").handler(
      { perfType: "bullet", nb: 100 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/player/top/100/bullet");
  });

  it("rejects invalid perfType (schema validation)", () => {
    expect(() =>
      findTool("get_leaderboard").schema.parse({ perfType: "invalid", nb: 10 }),
    ).toThrow();
  });
});

// ─── get_user_public_data ─────────────────────────────────────────────────────

describe("get_user_public_data", () => {
  it("GETs /api/user/{username}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "thibault" });

    await findTool("get_user_public_data").handler(
      { username: "thibault" },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/user/thibault") });
  });

  it("appends ?trophies=true when requested", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "thibault" });

    await findTool("get_user_public_data").handler(
      { username: "thibault", withTrophies: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("trophies=true");
  });
});

// ─── get_rating_history ───────────────────────────────────────────────────────

describe("get_rating_history", () => {
  it("GETs /api/user/{username}/rating-history", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_rating_history").handler({ username: "thibault" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/user/thibault/rating-history") });
  });
});

// ─── get_user_performance ─────────────────────────────────────────────────────

describe("get_user_performance", () => {
  it("GETs /api/user/{username}/perf/{perf}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ perf: { glicko: {} } });

    await findTool("get_user_performance").handler(
      { username: "thibault", perf: "blitz" },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/user/thibault/perf/blitz") });
  });
});

// ─── get_user_activity ────────────────────────────────────────────────────────

describe("get_user_activity", () => {
  it("GETs /api/user/{username}/activity", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_user_activity").handler({ username: "thibault" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/user/thibault/activity") });
  });
});

// ─── get_users_by_id ──────────────────────────────────────────────────────────

describe("get_users_by_id", () => {
  it("POSTs user ids as text/plain to /api/users", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "alice" }, { id: "bob" }]);

    await findTool("get_users_by_id").handler({ ids: "alice,bob" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/users"));
    expect(init.method).toBe("POST");
    expect(init.body).toBe("alice,bob");
  });

  it("rejects more than 300 ids (schema validation)", () => {
    const ids = Array.from({ length: 301 }, (_, i) => `user${i}`).join(",");
    expect(() => findTool("get_users_by_id").schema.parse({ ids })).toThrow();
  });
});

// ─── get_live_streamers ───────────────────────────────────────────────────────

describe("get_live_streamers", () => {
  it("GETs /api/streamer/live without auth", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "streamer1" }]);

    await findTool("get_live_streamers").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/streamer/live"));
    expect(init.headers.get("Authorization")).toBeNull();
  });
});

// ─── get_crosstable ───────────────────────────────────────────────────────────

describe("get_crosstable", () => {
  it("GETs /api/crosstable/{user1}/{user2}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ users: {} });

    await findTool("get_crosstable").handler(
      { user1: "alice", user2: "bob" },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/crosstable/alice/bob") });
  });

  it("appends ?matchup=true when requested", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_crosstable").handler(
      { user1: "alice", user2: "bob", matchup: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("matchup=true");
  });

  it("encodes usernames", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_crosstable").handler(
      { user1: "a b", user2: "c d" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
    expect(url).toContain("c%20d");
  });
});

// ─── autocomplete_player ──────────────────────────────────────────────────────

describe("autocomplete_player", () => {
  it("GETs /api/player/autocomplete with term", async () => {
    const mock = installFetchMock();
    mock.respondJson(["thibaul", "thibault"]);

    await findTool("autocomplete_player").handler({ term: "thibaul" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/player/autocomplete");
    expect(url).toContain("term=thibaul");
  });

  it("includes object=true flag", async () => {
    const mock = installFetchMock();
    mock.respondJson({ result: [] });

    await findTool("autocomplete_player").handler(
      { term: "thibaul", object: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("object=true");
  });

  it("includes friend=true flag", async () => {
    const mock = installFetchMock();
    mock.respondJson({ result: [] });

    await findTool("autocomplete_player").handler(
      { term: "thibaul", friend: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("friend=true");
  });
});

// ─── read_user_note ───────────────────────────────────────────────────────────

describe("read_user_note", () => {
  it("GETs /api/user/{username}/note", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ text: "Great player" }]);

    await findTool("read_user_note").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/user/alice/note") });
  });

  it("encodes username", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("read_user_note").handler({ username: "a b" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
  });
});
