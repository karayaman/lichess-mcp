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

describe("create_swiss", () => {
  it("POSTs form data to /api/swiss/new/{teamId}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newSwiss" });

    await findTool("create_swiss").handler(
      {
        name: "My Swiss",
        teamId: "myteam",
        clock: { limit: 300, increment: 5 },
        nbRounds: 7,
        variant: "standard",
        rated: true,
        roundInterval: 300,
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/swiss/new/myteam"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    const body = init.body?.toString() ?? "";
    expect(body).toContain("clock.limit=300");
    expect(body).toContain("clock.increment=5");
    expect(body).toContain("name=My+Swiss");
  });

  it("encodes teamId", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "new" });

    await findTool("create_swiss").handler(
      {
        name: "Test",
        teamId: "my team",
        clock: { limit: 300, increment: 0 },
        nbRounds: 5,
        variant: "standard",
        rated: true,
        roundInterval: 300,
      },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("my%20team");
  });
});

describe("get_swiss_info", () => {
  it("GETs /api/swiss/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "swissId" });

    await findTool("get_swiss_info").handler({ swissId: "swissId" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/swiss/swissId") });
  });
});

describe("get_swiss_games", () => {
  it("GETs /api/swiss/{id}/games as ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "game1" }]);

    await findTool("get_swiss_games").handler({ swissId: "swissId" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/swiss/swissId/games"));
  });

  it("includes optional filters", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_swiss_games").handler(
      { swissId: "swissId", player: "alice", moves: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("player=alice");
    expect(url).toContain("moves=true");
  });
});

describe("get_swiss_results", () => {
  it("GETs /api/swiss/{id}/results", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ rank: 1 }]);

    await findTool("get_swiss_results").handler({ swissId: "swissId" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/swiss/swissId/results"));
  });

  it("includes nb param when provided", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_swiss_results").handler({ swissId: "swissId", nb: 10 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=10");
  });
});

describe("join_swiss", () => {
  it("POSTs to /api/swiss/{id}/join", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("join_swiss").handler({ swissId: "swissId" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/swiss/swissId/join") });
  });
});

describe("withdraw_from_swiss", () => {
  it("POSTs to /api/swiss/{id}/withdraw", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("withdraw_from_swiss").handler({ swissId: "swissId" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/swiss/swissId/withdraw") });
  });
});

describe("update_swiss", () => {
  it("POSTs form data to /api/swiss/{id}/edit", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "swissId" });

    await findTool("update_swiss").handler(
      { swissId: "swissId", name: "Updated Swiss" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/swiss/swissId/edit"));
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("name=Updated+Swiss");
  });
});

describe("schedule_next_swiss_round", () => {
  it("POSTs date to /api/swiss/{id}/schedule-next-round", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("schedule_next_swiss_round").handler(
      { swissId: "swissId", date: 1700000000000 },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/swiss/swissId/schedule-next-round"));
    expect(init.body?.toString()).toContain("date=1700000000000");
  });
});

describe("terminate_swiss", () => {
  it("POSTs to /api/swiss/{id}/terminate", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("terminate_swiss").handler({ swissId: "swissId" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/swiss/swissId/terminate") });
  });
});

describe("get_swiss_trf", () => {
  it("GETs /swiss/{id}.trf from lichess.org", async () => {
    const mock = installFetchMock();
    mock.respondText("001 Swiss Tournament\n");

    const result = await findTool("get_swiss_trf").handler({ swissId: "swissId" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe("https://lichess.org/swiss/swissId.trf");
    expect(String(result)).toContain("Swiss Tournament");
  });
});
