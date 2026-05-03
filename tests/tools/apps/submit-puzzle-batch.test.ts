import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  apiUrl,
} from "../../helpers/mock.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("submit_puzzle_batch", () => {
  it("is registered as an app-only callback (visibility ['app'], no iframe resource)", () => {
    const t = findTool("submit_puzzle_batch");
    expect(t.ui?.visibility).toEqual(["app"]);
    expect(t.ui?.resourceUri).toBeUndefined();
    expect(t.ui?.htmlFile).toBeUndefined();
  });

  it("POSTs the spec body shape {solutions:[{id,win,rated}]} to /puzzle/batch/{angle}", async () => {
    const mock = installFetchMock();
    mock.respondJson({
      rounds: [{ id: "P1", win: true, ratingDiff: 5 }],
      glicko: { rating: 1505, deviation: 80 },
    });

    await findTool("submit_puzzle_batch").handler(
      {
        angle: "mix",
        solutions: [
          { id: "P1", win: true },
          { id: "P2", win: false, rated: false },
        ],
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/puzzle/batch/mix"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.solutions).toEqual([
      { id: "P1", win: true, rated: true },
      { id: "P2", win: false, rated: false },
    ]);
  });

  it("returns the parsed Lichess response (rounds + glicko)", async () => {
    const mock = installFetchMock();
    const payload = {
      rounds: [{ id: "P1", win: true, ratingDiff: 5 }],
      glicko: { rating: 1505, deviation: 80 },
    };
    mock.respondJson(payload);

    const result = await findTool("submit_puzzle_batch").handler(
      {
        angle: "mix",
        solutions: [{ id: "P1", win: true }],
      },
      makeContext(),
    );

    expect(result).toEqual(payload);
  });

  it("encodes the angle in the URL", async () => {
    const mock = installFetchMock();
    mock.respondJson({});
    await findTool("submit_puzzle_batch").handler(
      {
        angle: "queen sacrifice",
        solutions: [{ id: "X", win: true }],
      },
      makeContext(),
    );
    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("queen%20sacrifice");
  });

  it("rejects empty solutions array", () => {
    const t = findTool("submit_puzzle_batch");
    expect(() => t.schema.parse({ angle: "mix", solutions: [] })).toThrow();
  });
});
