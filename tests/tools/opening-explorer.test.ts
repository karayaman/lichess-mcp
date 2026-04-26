import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
} from "../helpers/mock.js";

const EXPLORER_BASE = "https://explorer.lichess.org";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("get_masters_openings", () => {
  it("GETs explorer.lichess.org/masters with bearer auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ opening: null, moves: [] });

    await findTool("get_masters_openings").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(`${EXPLORER_BASE}/masters`);
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("includes fen, play, since, until, moves, topGames params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ moves: [] });

    await findTool("get_masters_openings").handler(
      {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        play: "g1f3",
        since: "2020",
        until: "2024",
        moves: 10,
        topGames: 5,
      },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("fen=");
    expect(url).toContain("play=g1f3");
    expect(url).toContain("since=2020");
    expect(url).toContain("until=2024");
    expect(url).toContain("moves=10");
    expect(url).toContain("topGames=5");
  });
});

describe("get_lichess_openings", () => {
  it("GETs explorer.lichess.org/lichess with bearer auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ moves: [] });

    await findTool("get_lichess_openings").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(`${EXPLORER_BASE}/lichess`);
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("includes optional params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ moves: [] });

    await findTool("get_lichess_openings").handler(
      {
        variant: "standard",
        speeds: "blitz,rapid",
        ratings: "1600,1800",
        since: "2023-01",
        moves: 5,
      },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("speeds=blitz%2Crapid");
    expect(url).toContain("ratings=1600%2C1800");
  });
});

describe("get_player_openings", () => {
  it("GETs explorer.lichess.org/player as ndjson with bearer auth", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ moves: [] }]);

    const result = await findTool("get_player_openings").handler(
      { player: "thibault", color: "white" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain(`${EXPLORER_BASE}/player?`);
    expect(url).toContain("player=thibault");
    expect(url).toContain("color=white");
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects invalid color (schema validation)", () => {
    expect(() =>
      findTool("get_player_openings").schema.parse({
        player: "thibault",
        color: "random",
      }),
    ).toThrow();
  });
});

describe("get_master_game", () => {
  it("GETs explorer.lichess.org/masters/pgn/{gameId} with Accept PGN header and bearer auth", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]\n1. e4 e5");

    const result = await findTool("get_master_game").handler({ gameId: "abc123" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(`${EXPLORER_BASE}/masters/pgn/abc123`);
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
    expect(String(result)).toContain("[Event ?]");
  });
});
