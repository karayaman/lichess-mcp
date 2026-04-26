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

describe("get_cloud_eval", () => {
  it("GETs /api/cloud-eval with fen and multiPv params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR", pvs: [] });

    await findTool("get_cloud_eval").handler(
      { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", multiPv: 1 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/cloud-eval");
    expect(url).toContain("fen=");
    expect(url).toContain("multiPv=1");
  });

  it("rejects multiPv > 5 (schema validation)", () => {
    expect(() =>
      findTool("get_cloud_eval").schema.parse({
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        multiPv: 6,
      }),
    ).toThrow();
  });
});

describe("get_fide_player", () => {
  it("GETs /api/fide/player/{playerId}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "12345", name: "Carlsen, Magnus" });

    await findTool("get_fide_player").handler({ playerId: "12345" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/fide/player/12345") });
  });
});

describe("search_fide_players", () => {
  it("GETs /api/fide/player with q param", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "12345", name: "Carlsen, Magnus" }]);

    await findTool("search_fide_players").handler({ name: "carlsen" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/fide/player");
    expect(url).toContain("carlsen");
  });
});

describe("get_fide_player_ratings", () => {
  it("GETs /api/fide/player/{playerId}/ratings", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ month: "2024-01", rating: 2832 }]);

    await findTool("get_fide_player_ratings").handler({ playerId: "12345" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/fide/player/12345/ratings") });
  });
});
