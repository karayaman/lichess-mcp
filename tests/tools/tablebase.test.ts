import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
} from "../helpers/mock.js";

const TABLEBASE_BASE = "https://tablebase.lichess.org";
const SAMPLE_FEN = "8/8/8/8/8/3k4/8/3K4 w - - 0 1";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("lookup_standard_tablebase", () => {
  it("GETs tablebase.lichess.ovh/standard without auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ category: "draw", moves: [] });

    await findTool("lookup_standard_tablebase").handler({ fen: SAMPLE_FEN }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain(`${TABLEBASE_BASE}/standard`);
    expect(url).toContain("fen=");
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("includes dtc param when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({ category: "win" });

    await findTool("lookup_standard_tablebase").handler(
      { fen: SAMPLE_FEN, dtc: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("dtc=true");
  });
});

describe("lookup_atomic_tablebase", () => {
  it("GETs tablebase.lichess.ovh/atomic without auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ category: "win" });

    await findTool("lookup_atomic_tablebase").handler({ fen: SAMPLE_FEN }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain(`${TABLEBASE_BASE}/atomic`);
    expect(init.headers.get("Authorization")).toBeNull();
  });
});

describe("lookup_antichess_tablebase", () => {
  it("GETs tablebase.lichess.ovh/antichess without auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ category: "loss" });

    await findTool("lookup_antichess_tablebase").handler({ fen: SAMPLE_FEN }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain(`${TABLEBASE_BASE}/antichess`);
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("rejects empty fen (schema validation)", () => {
    expect(() =>
      findTool("lookup_antichess_tablebase").schema.parse({ fen: "" }),
    ).toThrow();
  });
});
