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

describe("list_bulk_pairings", () => {
  it("GETs /api/bulk-pairing", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("list_bulk_pairings").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/bulk-pairing") });
  });
});

describe("create_bulk_pairing", () => {
  it("POSTs form data to /api/bulk-pairing", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "bp1" });

    await findTool("create_bulk_pairing").handler(
      {
        players: "tok1:tok2,tok3:tok4",
        "clock.limit": 300,
        "clock.increment": 5,
        rated: false,
        variant: "standard",
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/bulk-pairing"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    const body = init.body?.toString() ?? "";
    expect(body).toContain("players=tok1%3Atok2%2Ctok3%3Atok4");
    expect(body).toContain("clock.limit=300");
    expect(body).toContain("clock.increment=5");
  });

  it("includes pairAt and startClocksAt when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "bp1" });

    await findTool("create_bulk_pairing").handler(
      {
        players: "tok1:tok2",
        "clock.limit": 300,
        "clock.increment": 0,
        pairAt: 1700000000000,
        startClocksAt: 1700000060000,
        rated: false,
        variant: "standard",
      },
      makeContext(),
    );

    const [, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const body = init.body?.toString() ?? "";
    expect(body).toContain("pairAt=1700000000000");
    expect(body).toContain("startClocksAt=1700000060000");
  });

  it("rejects clock.limit > 10800 (schema validation)", () => {
    expect(() =>
      findTool("create_bulk_pairing").schema.parse({
        players: "tok1:tok2",
        "clock.limit": 10801,
        "clock.increment": 0,
      }),
    ).toThrow();
  });
});

describe("start_bulk_pairing_clocks", () => {
  it("POSTs to /api/bulk-pairing/{id}/start-clocks", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("start_bulk_pairing_clocks").handler({ id: "bp1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bulk-pairing/bp1/start-clocks") });
  });
});

describe("get_bulk_pairing", () => {
  it("GETs /api/bulk-pairing/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "bp1" });

    await findTool("get_bulk_pairing").handler({ id: "bp1" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/bulk-pairing/bp1") });
  });
});

describe("delete_bulk_pairing", () => {
  it("DELETEs /api/bulk-pairing/{id}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("delete_bulk_pairing").handler({ id: "bp1" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/bulk-pairing/bp1"));
    expect(init.method).toBe("DELETE");
  });
});

describe("get_bulk_pairing_games", () => {
  it("GETs /api/bulk-pairing/{id}/games as ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "game1" }]);

    const result = await findTool("get_bulk_pairing_games").handler({ id: "bp1" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/bulk-pairing/bp1/games"));
    expect(Array.isArray(result)).toBe(true);
  });
});
