import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
} from "../../helpers/mock.js";
import type {
  ExplorerData,
  OpeningsProps,
  UiToolResult,
} from "../../../src/types/ui-props.js";

const EXPLORER_BASE = "https://explorer.lichess.org";
const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

beforeEach(() => {
  vi.restoreAllMocks();
});

const EMPTY_DATA: ExplorerData = {
  white: 100,
  draws: 50,
  black: 80,
  moves: [
    { uci: "e2e4", san: "e4", white: 60, draws: 30, black: 40 },
    { uci: "d2d4", san: "d4", white: 40, draws: 20, black: 40 },
  ],
  topGames: [
    {
      id: "G1",
      uci: "e2e4",
      winner: "white",
      white: { name: "Carlsen", rating: 2830 },
      black: { name: "Nepomniachtchi", rating: 2790 },
      year: 2024,
    },
  ],
  opening: { eco: "B00", name: "Random Opening" },
};

describe("explore_openings", () => {
  it("is registered with a UI descriptor", () => {
    const t = findTool("explore_openings");
    expect(t.ui).toEqual({
      resourceUri: "ui://lichess-mcp/openings.html",
      htmlFile: "openings.html",
    });
  });

  it("defaults to masters source and the starting position", async () => {
    const mock = installFetchMock();
    mock.respondJson(EMPTY_DATA);

    const result = (await findTool("explore_openings").handler(
      { source: "masters" },
      makeContext(),
    )) as UiToolResult<OpeningsProps>;

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain(`${EXPLORER_BASE}/masters`);
    const search = new URLSearchParams((url as string).split("?")[1]);
    expect(search.get("fen")).toBe(STARTING_FEN);
    expect(result.props.rootFen).toBe(STARTING_FEN);
    expect(result.props.play).toBe("");
    expect(result.props.currentFen).toBe(STARTING_FEN);
    expect(result.props.source).toBe("masters");
    expect(result.props.initialData.opening?.name).toBe("Random Opening");
  });

  it("hits the lichess endpoint when source is 'lichess'", async () => {
    const mock = installFetchMock();
    mock.respondJson(EMPTY_DATA);

    await findTool("explore_openings").handler(
      { source: "lichess" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain(`${EXPLORER_BASE}/lichess`);
  });

  it("threads play UCIs into the request and updates currentFen", async () => {
    const mock = installFetchMock();
    mock.respondJson(EMPTY_DATA);

    const result = (await findTool("explore_openings").handler(
      { play: "e2e4,e7e5", source: "masters" },
      makeContext(),
    )) as UiToolResult<OpeningsProps>;

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("play=e2e4%2Ce7e5");
    expect(result.props.play).toBe("e2e4,e7e5");
    // After 1.e4 e5 white moves next → side to move "w".
    expect(result.props.currentFen.split(" ")[1]).toBe("w");
    expect(result.props.currentFen).not.toBe(STARTING_FEN);
  });

  it("rejects illegal play sequences", async () => {
    const mock = installFetchMock();
    mock.respondJson(EMPTY_DATA);

    await expect(
      findTool("explore_openings").handler(
        { play: "e2e5", source: "masters" }, // pawn cannot e2→e5
        makeContext(),
      ),
    ).rejects.toThrow(/Invalid|Illegal/);
  });

  it("text fallback summarizes top moves and source", async () => {
    const mock = installFetchMock();
    mock.respondJson(EMPTY_DATA);

    const result = (await findTool("explore_openings").handler(
      { source: "masters" },
      makeContext(),
    )) as UiToolResult<OpeningsProps>;

    expect(result.text).toContain("Random Opening");
    expect(result.text).toContain("Source: masters");
    expect(result.text).toContain("Top moves:");
    expect(result.text).toContain("e4");
    expect(result.text).toContain("d4");
  });
});
