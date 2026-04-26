import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
  lichessUrl,
} from "../helpers/mock.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── export_game ──────────────────────────────────────────────────────────────

describe("export_game", () => {
  it("GETs /game/export/{gameId} and returns PGN text", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]\n1. e4 e5");

    const result = await findTool("export_game").handler(
      { gameId: "abcd1234" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/game/export/abcd1234");
    expect(String(result)).toContain("[Event ?]");
  });

  it("includes optional boolean flags in query string", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_game").handler(
      { gameId: "abcd1234", moves: true, clocks: true, evals: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("moves=true");
    expect(url).toContain("clocks=true");
    expect(url).toContain("evals=true");
  });

  it("JSON-stringifies the result when server returns JSON content-type", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "abcd1234", moves: "e4 e5" });

    const result = await findTool("export_game").handler(
      { gameId: "abcd1234" },
      makeContext(),
    );

    expect(String(result)).toContain("abcd1234");
  });

  it("rejects gameId not exactly 8 chars (schema validation)", () => {
    expect(() => findTool("export_game").schema.parse({ gameId: "short" })).toThrow();
    expect(() => findTool("export_game").schema.parse({ gameId: "toolongid" })).toThrow();
  });
});

// ─── export_ongoing_game ──────────────────────────────────────────────────────

describe("export_ongoing_game", () => {
  it("GETs /api/user/{username}/current-game", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_ongoing_game").handler({ username: "alice" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/user/alice/current-game");
  });

  it("includes optional flags", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("export_ongoing_game").handler(
      { username: "alice", moves: true, opening: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("moves=true");
    expect(url).toContain("opening=true");
  });
});

// ─── export_user_games ────────────────────────────────────────────────────────

describe("export_user_games", () => {
  it("GETs /api/games/user/{username}", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_user_games").handler({ username: "alice" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/games/user/alice");
  });

  it("parses ndjson when server returns application/x-ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "g1" }, { id: "g2" }]);

    const result = await findTool("export_user_games").handler({ username: "alice" }, makeContext());

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(2);
  });

  it("falls back to JSON when content-type is neither pgn nor ndjson", async () => {
    const mock = installFetchMock();
    mock.respondJson({ games: [] });

    const result = await findTool("export_user_games").handler({ username: "alice" }, makeContext());

    expect(result).toMatchObject({ games: [] });
  });

  it("falls back to JSON when response has no content-type header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ games: [] }),
      text: async () => '{"games":[]}',
    }));

    const result = await findTool("export_user_games").handler({ username: "alice" }, makeContext());

    expect(result).toMatchObject({ games: [] });
  });

  it("includes optional filters", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("export_user_games").handler(
      { username: "alice", max: 10, rated: true, perfType: "blitz", color: "white" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("max=10");
    expect(url).toContain("rated=true");
    expect(url).toContain("perfType=blitz");
    expect(url).toContain("color=white");
  });

  it("rejects since timestamp before Lichess birthday", () => {
    expect(() =>
      findTool("export_user_games").schema.parse({ username: "alice", since: 1000000 }),
    ).toThrow();
  });
});

// ─── export_games_by_ids ──────────────────────────────────────────────────────

describe("export_games_by_ids", () => {
  it("POSTs game IDs as text to /api/games/export/_ids", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_games_by_ids").handler(
      { ids: "abcd1234,efgh5678" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/games/export/_ids");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("abcd1234,efgh5678");
  });

  it("parses ndjson when server returns application/x-ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "g1" }]);

    const result = await findTool("export_games_by_ids").handler(
      { ids: "abcd1234" },
      makeContext(),
    );

    expect(Array.isArray(result)).toBe(true);
  });

  it("falls back to JSON when content-type is neither pgn nor ndjson", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "g1" }]);

    const result = await findTool("export_games_by_ids").handler(
      { ids: "abcd1234" },
      makeContext(),
    );

    expect(Array.isArray(result)).toBe(true);
  });

  it("includes flags in query string when provided", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_games_by_ids").handler(
      { ids: "abcd1234", moves: true, clocks: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("moves=true");
    expect(url).toContain("clocks=true");
  });

  it("falls back to JSON when response has no content-type header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => [{ id: "g1" }],
      text: async () => '[{"id":"g1"}]',
    }));

    const result = await findTool("export_games_by_ids").handler(
      { ids: "abcd1234" },
      makeContext(),
    );

    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects more than 300 ids (schema validation)", () => {
    const ids = Array.from({ length: 301 }, (_, i) => `abcd${i.toString().padStart(4, "0")}`).join(",");
    expect(() => findTool("export_games_by_ids").schema.parse({ ids })).toThrow();
  });
});

// ─── get_ongoing_games ────────────────────────────────────────────────────────

describe("get_ongoing_games", () => {
  it("GETs /api/account/playing with default nb=9", async () => {
    const mock = installFetchMock();
    mock.respondJson({ nowPlaying: [] });

    await findTool("get_ongoing_games").handler({ nb: 9 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/account/playing?nb=9"));
  });

  it("rejects nb > 50 (schema validation)", () => {
    expect(() => findTool("get_ongoing_games").schema.parse({ nb: 51 })).toThrow();
  });
});

// ─── get_game_chat ────────────────────────────────────────────────────────────

describe("get_game_chat", () => {
  it("GETs /game/{gameId}/chat", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ text: "gg", user: "alice" }]);

    await findTool("get_game_chat").handler({ gameId: "abcd1234" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/game/abcd1234/chat");
  });
});

// ─── import_game ──────────────────────────────────────────────────────────────

describe("import_game", () => {
  it("POSTs PGN form data to /api/import", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newgame1", url: "https://lichess.org/newgame1" });

    await findTool("import_game").handler({ pgn: "[Event ?]\n1. e4" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/import"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("pgn=");
  });
});

// ─── get_imported_games ───────────────────────────────────────────────────────

describe("get_imported_games", () => {
  it("GETs /api/games/export/imports", async () => {
    const mock = installFetchMock();
    mock.respondJson({ games: [] });

    await findTool("get_imported_games").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/games/export/imports") });
  });
});

// ─── get_bookmarked_games ─────────────────────────────────────────────────────

describe("get_bookmarked_games", () => {
  it("GETs /api/games/export/bookmarks", async () => {
    const mock = installFetchMock();
    mock.respondJson({ games: [] });

    await findTool("get_bookmarked_games").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/games/export/bookmarks") });
  });
});
