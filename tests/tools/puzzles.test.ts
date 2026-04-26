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

describe("get_daily_puzzle", () => {
  it("GETs /api/puzzle/daily", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzle: { id: "abc" } });

    await findTool("get_daily_puzzle").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/daily") });
  });
});

describe("get_puzzle_by_id", () => {
  it("GETs /api/puzzle/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzle: { id: "Bmfot" } });

    await findTool("get_puzzle_by_id").handler({ id: "Bmfot" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/Bmfot") });
  });

  it("encodes puzzle id", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_puzzle_by_id").handler({ id: "a b" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
  });
});

describe("get_next_puzzle", () => {
  it("GETs /api/puzzle/next with no params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzle: {} });

    await findTool("get_next_puzzle").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/next") });
  });

  it("includes optional params when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({});

    await findTool("get_next_puzzle").handler(
      { angle: "endgame", difficulty: "hard", color: "white" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("angle=endgame");
    expect(url).toContain("difficulty=hard");
    expect(url).toContain("color=white");
  });
});

describe("get_puzzle_batch", () => {
  it("GETs /api/puzzle/batch/{angle}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });

    await findTool("get_puzzle_batch").handler({ angle: "mix" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/batch/mix") });
  });

  it("includes optional params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });

    await findTool("get_puzzle_batch").handler(
      { angle: "endgame", nb: 50, difficulty: "medium" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=50");
    expect(url).toContain("difficulty=medium");
  });

  it("includes color param when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });

    await findTool("get_puzzle_batch").handler(
      { angle: "mix", color: "black" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("color=black");
  });
});

describe("solve_puzzle_batch", () => {
  it("POSTs solutions JSON to /api/puzzle/batch/{angle}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });

    await findTool("solve_puzzle_batch").handler(
      {
        angle: "mix",
        solutions: [{ id: "abc", win: true, time: 3000 }],
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/puzzle/batch/mix"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.solutions[0].id).toBe("abc");
  });

  it("includes nb param in query string", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });

    await findTool("solve_puzzle_batch").handler(
      { angle: "mix", solutions: [], nb: 10 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=10");
  });
});

describe("replay_puzzles", () => {
  it("GETs /api/puzzle/replay/{days}/{theme}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzle: {} });

    await findTool("replay_puzzles").handler({ days: 7, theme: "endgame" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/replay/7/endgame") });
  });
});

describe("get_puzzle_activity", () => {
  it("GETs /api/puzzle/activity with no params", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_puzzle_activity").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/activity") });
  });

  it("includes max param", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_puzzle_activity").handler({ max: 50 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("max=50");
  });

  it("rejects max > 200 (schema validation)", () => {
    expect(() => findTool("get_puzzle_activity").schema.parse({ max: 201 })).toThrow();
  });
});

describe("get_puzzle_dashboard", () => {
  it("GETs /api/puzzle/dashboard/{days}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ days: [] });

    await findTool("get_puzzle_dashboard").handler({ days: 30 }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/dashboard/30") });
  });
});

describe("get_puzzle_race", () => {
  it("GETs /api/racer/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "race1" });

    await findTool("get_puzzle_race").handler({ raceId: "race1" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/racer/race1") });
  });
});

describe("create_puzzle_race", () => {
  it("POSTs to /api/racer", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newrace" });

    await findTool("create_puzzle_race").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/racer"));
    expect(init.method).toBe("POST");
  });
});

describe("get_puzzle_storm_dashboard", () => {
  it("GETs /api/storm/dashboard/{username} with days param", async () => {
    const mock = installFetchMock();
    mock.respondJson({ days: [] });

    await findTool("get_puzzle_storm_dashboard").handler(
      { username: "alice", days: 30 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/storm/dashboard/alice?days=30"));
  });

  it("rejects days > 30 (schema validation)", () => {
    expect(() =>
      findTool("get_puzzle_storm_dashboard").schema.parse({ username: "alice", days: 31 }),
    ).toThrow();
  });
});
