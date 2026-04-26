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

describe("get_official_broadcasts", () => {
  it("GETs /api/broadcast as ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "b1" }]);

    await findTool("get_official_broadcasts").handler({}, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/broadcast"));
  });

  it("includes nb param when provided", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_official_broadcasts").handler({ nb: 5 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=5");
  });
});

describe("get_top_broadcasts", () => {
  it("GETs /api/broadcast/top", async () => {
    const mock = installFetchMock();
    mock.respondJson({ active: [] });

    await findTool("get_top_broadcasts").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/broadcast/top") });
  });

  it("includes page param", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_top_broadcasts").handler({ page: 2 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("page=2");
  });
});

describe("get_broadcasts_by_user", () => {
  it("GETs /api/broadcast/by/{username}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ broadcasts: [] });

    await findTool("get_broadcasts_by_user").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/broadcast/by/alice") });
  });

  it("includes page param when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_broadcasts_by_user").handler({ username: "alice", page: 2 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("page=2");
  });
});

describe("search_broadcasts", () => {
  it("GETs /api/broadcast/search with query", async () => {
    const mock = installFetchMock();
    mock.respondJson({ broadcasts: [] });

    await findTool("search_broadcasts").handler({ q: "chess olympiad" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/broadcast/search");
    expect(url).toContain("q=chess+olympiad");
  });

  it("includes page param when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("search_broadcasts").handler({ q: "chess", page: 3 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("page=3");
  });
});

describe("create_broadcast_tournament", () => {
  it("POSTs form data to /broadcast/new", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newBroadcast" });

    await findTool("create_broadcast_tournament").handler(
      { name: "My Championship" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/new");
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("name=My+Championship");
  });
});

describe("get_broadcast_tournament", () => {
  it("GETs /api/broadcast/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "bid" });

    await findTool("get_broadcast_tournament").handler(
      { broadcastTournamentId: "bid" },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/broadcast/bid") });
  });
});

describe("get_broadcast_players", () => {
  it("GETs /broadcast/{id}/players", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_broadcast_players").handler(
      { broadcastTournamentId: "bid" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/broadcast/bid/players");
  });
});

describe("get_broadcast_player", () => {
  it("GETs /broadcast/{tourId}/players/{playerId}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "12345" });

    await findTool("get_broadcast_player").handler(
      { broadcastTournamentId: "bid", playerId: "12345" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/broadcast/bid/players/12345");
  });
});

describe("get_broadcast_team_leaderboard", () => {
  it("GETs /broadcast/{id}/teams/standings", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_broadcast_team_leaderboard").handler(
      { broadcastTournamentId: "bid" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/broadcast/bid/teams/standings");
  });
});

describe("update_broadcast_tournament", () => {
  it("POSTs form data to /broadcast/{id}/edit", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("update_broadcast_tournament").handler(
      { broadcastTournamentId: "bid", name: "Updated Name" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/bid/edit");
    expect(init.body?.toString()).toContain("name=Updated+Name");
  });
});

describe("create_broadcast_round", () => {
  it("POSTs form data to /broadcast/{id}/new", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "round1" });

    await findTool("create_broadcast_round").handler(
      { broadcastTournamentId: "bid", name: "Round 1" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/bid/new");
    expect(init.body?.toString()).toContain("name=Round+1");
  });
});

describe("get_broadcast_round", () => {
  it("GETs /api/broadcast/{tourSlug}/{roundSlug}/{roundId}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "rid" });

    await findTool("get_broadcast_round").handler(
      {
        broadcastTournamentSlug: "my-champ",
        broadcastRoundSlug: "round-1",
        broadcastRoundId: "rid",
      },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/broadcast/my-champ/round-1/rid"));
  });
});

describe("update_broadcast_round", () => {
  it("POSTs form data to /broadcast/round/{id}/edit", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("update_broadcast_round").handler(
      { broadcastRoundId: "rid", name: "Round 2" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/round/rid/edit");
    expect(init.body?.toString()).toContain("name=Round+2");
  });
});

describe("reset_broadcast_round", () => {
  it("POSTs to /api/broadcast/round/{id}/reset", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("reset_broadcast_round").handler({ broadcastRoundId: "rid" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/broadcast/round/rid/reset"));
    expect(init.method).toBe("POST");
  });
});

describe("push_broadcast_round_pgn", () => {
  it("POSTs PGN text to /api/broadcast/round/{id}/push", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("push_broadcast_round_pgn").handler(
      { broadcastRoundId: "rid", pgn: "[Event ?]\n1. e4" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/broadcast/round/rid/push"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("text/plain");
    expect(init.body).toContain("[Event ?]");
  });
});

describe("get_broadcast_round_pgn", () => {
  it("GETs /api/broadcast/round/{id}.pgn with Accept header", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    const result = await findTool("get_broadcast_round_pgn").handler(
      { broadcastRoundId: "rid" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/round/rid.pgn");
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
    expect(String(result)).toContain("[Event ?]");
  });

  it("includes clocks and comments flags", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("get_broadcast_round_pgn").handler(
      { broadcastRoundId: "rid", clocks: true, comments: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("clocks=true");
    expect(url).toContain("comments=true");
  });
});

describe("get_broadcast_all_rounds_pgn", () => {
  it("GETs /api/broadcast/{id}.pgn", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("get_broadcast_all_rounds_pgn").handler(
      { broadcastTournamentId: "bid" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/broadcast/bid.pgn");
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
  });

  it("includes clocks and comments flags when provided", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("get_broadcast_all_rounds_pgn").handler(
      { broadcastTournamentId: "bid", clocks: true, comments: false },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("clocks=true");
    expect(url).toContain("comments=false");
  });
});

describe("get_my_broadcast_rounds", () => {
  it("GETs /api/broadcast/my-rounds", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "rid" }]);

    await findTool("get_my_broadcast_rounds").handler({}, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/broadcast/my-rounds"));
  });

  it("includes nb param", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_my_broadcast_rounds").handler({ nb: 10 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=10");
  });
});
