import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
} from "../../helpers/mock.js";
import type { UiToolResult, PuzzleProps } from "../../../src/types/ui-props.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

interface PuzzlePayload {
  game: { id: string; pgn: string };
  puzzle: {
    id: string;
    initialPly: number;
    fen?: string;
    solution: string[];
    themes: string[];
    rating: number;
  };
}

function makePuzzlePayload(overrides: Partial<PuzzlePayload> = {}): PuzzlePayload {
  return {
    game: { id: "abcdefgh", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5" },
    puzzle: {
      id: "PUZ01",
      initialPly: 4,
      solution: ["a7a6", "b5a4", "g8f6"],
      themes: ["opening", "fork"],
      rating: 1500,
    },
    ...overrides,
  };
}

describe("play_puzzle (single mode)", () => {
  it("is registered with a UI descriptor pointing to the puzzle resource", () => {
    const t = findTool("play_puzzle");
    expect(t.ui).toEqual({
      resourceUri: "ui://lichess-mcp/puzzle.html",
      htmlFile: "puzzle.html",
    });
  });

  it("GETs /puzzle/daily by default", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());
    await findTool("play_puzzle").handler({}, makeContext());
    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/daily") });
  });

  it("GETs /puzzle/next when next:true", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());
    await findTool("play_puzzle").handler({ next: true }, makeContext());
    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/next") });
  });

  it("GETs /puzzle/{id} when an id is provided", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());
    await findTool("play_puzzle").handler({ puzzleId: "Bmfot" }, makeContext());
    expectFetch(mock, { method: "GET", url: apiUrl("/puzzle/Bmfot") });
  });

  it("returns puzzles[1] with computed FEN/orientation and unrated session", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());

    const result = (await findTool("play_puzzle").handler(
      {},
      makeContext(),
    )) as UiToolResult<PuzzleProps>;

    expect(result.__uiResult).toBe(true);
    expect(result.props.puzzles).toHaveLength(1);
    const spec = result.props.puzzles[0];
    expect(spec.puzzleId).toBe("PUZ01");
    expect(spec.solution).toEqual(["a7a6", "b5a4", "g8f6"]);
    expect(spec.rating).toBe(1500);
    expect(spec.themes).toEqual(["opening", "fork"]);
    expect(spec.lichessUrl).toBe("https://lichess.org/training/PUZ01");
    // After 1.e4 e5 2.Nf3 Nc6 3.Bb5 black is to move.
    expect(spec.orientation).toBe("black");
    expect(spec.fen.split(" ")[1]).toBe("b");
    expect(result.props.session).toEqual({ angle: "", rated: false });
  });

  it("prefers puzzle.fen from the API over PGN reconstruction when present", async () => {
    const mock = installFetchMock();
    const explicitFen = "8/8/8/8/8/8/8/4K2k w - - 0 1";
    mock.respondJson(
      makePuzzlePayload({
        puzzle: {
          id: "FENWINS",
          initialPly: 4,
          fen: explicitFen,
          solution: ["e1e2"],
          themes: [],
          rating: 1234,
        },
      }),
    );
    const result = (await findTool("play_puzzle").handler(
      {},
      makeContext(),
    )) as UiToolResult<PuzzleProps>;
    expect(result.props.puzzles[0].fen).toBe(explicitFen);
    expect(result.props.puzzles[0].orientation).toBe("white");
  });

  it("computes orientation 'white' when initialPly leaves white to move", async () => {
    const mock = installFetchMock();
    mock.respondJson(
      makePuzzlePayload({
        game: { id: "g", pgn: "1. e4 e5" },
        puzzle: {
          id: "WHT01",
          initialPly: 1,
          solution: ["g1f3"],
          themes: [],
          rating: 1000,
        },
      }),
    );

    const result = (await findTool("play_puzzle").handler(
      {},
      makeContext(),
    )) as UiToolResult<PuzzleProps>;

    expect(result.props.puzzles[0].orientation).toBe("white");
    expect(result.props.puzzles[0].fen.split(" ")[1]).toBe("w");
  });

  it("text fallback includes id, rating, themes, FEN, and lichess link", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());
    const result = (await findTool("play_puzzle").handler(
      {},
      makeContext(),
    )) as UiToolResult<PuzzleProps>;
    expect(result.text).toContain("Puzzle PUZ01");
    expect(result.text).toContain("rating 1500");
    expect(result.text).toContain("opening, fork");
    expect(result.text).toContain("https://lichess.org/training/PUZ01");
    expect(result.text).toContain("FEN:");
    expect(result.text).toContain("Solution (UCI):");
  });

  it("encodes puzzle id in the URL", async () => {
    const mock = installFetchMock();
    mock.respondJson(makePuzzlePayload());
    await findTool("play_puzzle").handler({ puzzleId: "a/b c" }, makeContext());
    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%2Fb%20c");
  });

  it("names the puzzle id when its PGN fails to parse", async () => {
    const mock = installFetchMock();
    mock.respondJson(
      makePuzzlePayload({
        game: { id: "g", pgn: '[Event "x"]\n1. zz' },
        puzzle: {
          id: "BADPGN",
          initialPly: 0,
          solution: ["a2a4"],
          themes: [],
          rating: 1000,
        },
      }),
    );

    await expect(
      findTool("play_puzzle").handler({}, makeContext()),
    ).rejects.toThrow(/Puzzle BADPGN has an invalid PGN/);
  });
});

describe("play_puzzle (rated batch mode)", () => {
  it("GETs /puzzle/batch/{angle}?nb=N with nb defaulting to 10 and angle to mix", async () => {
    const mock = installFetchMock();
    mock.respondJson({
      puzzles: [makePuzzlePayload(), makePuzzlePayload({ puzzle: { ...makePuzzlePayload().puzzle, id: "PUZ02" } })],
    });

    await findTool("play_puzzle").handler({ rated: true }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/puzzle/batch/mix?nb=10"));
  });

  it("threads angle, nb, difficulty into the request", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [makePuzzlePayload()] });

    await findTool("play_puzzle").handler(
      { rated: true, angle: "endgame", nb: 5, difficulty: "harder" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/puzzle/batch/endgame");
    expect(url).toContain("nb=5");
    expect(url).toContain("difficulty=harder");
  });

  it("returns puzzles[N] with rated session matching the requested angle", async () => {
    const mock = installFetchMock();
    mock.respondJson({
      puzzles: [
        makePuzzlePayload({
          puzzle: { id: "P1", initialPly: 0, solution: ["e2e4"], themes: [], rating: 1500 },
          game: { id: "g1", pgn: "" },
        }),
        makePuzzlePayload({
          puzzle: { id: "P2", initialPly: 0, solution: ["d2d4"], themes: [], rating: 1600 },
          game: { id: "g2", pgn: "" },
        }),
      ],
    });

    const result = (await findTool("play_puzzle").handler(
      { rated: true, angle: "endgame", nb: 2 },
      makeContext(),
    )) as UiToolResult<PuzzleProps>;

    expect(result.props.puzzles).toHaveLength(2);
    expect(result.props.puzzles[0].puzzleId).toBe("P1");
    expect(result.props.puzzles[1].puzzleId).toBe("P2");
    expect(result.props.session).toEqual({ angle: "endgame", rated: true });
  });

  it("text fallback lists each puzzle's id, rating, and lichess link", async () => {
    const mock = installFetchMock();
    mock.respondJson({
      puzzles: [
        makePuzzlePayload({
          puzzle: { id: "P1", initialPly: 0, solution: ["e2e4"], themes: [], rating: 1500 },
          game: { id: "g1", pgn: "" },
        }),
      ],
    });

    const result = (await findTool("play_puzzle").handler(
      { rated: true, nb: 1 },
      makeContext(),
    )) as UiToolResult<PuzzleProps>;

    expect(result.text).toContain("Rated batch:");
    expect(result.text).toContain("angle mix");
    expect(result.text).toContain("P1");
    expect(result.text).toContain("https://lichess.org/training/P1");
  });

  it("only honors color when nb=1", async () => {
    const mock = installFetchMock();
    mock.respondJson({ puzzles: [] });
    await findTool("play_puzzle").handler(
      { rated: true, nb: 5, color: "white" },
      makeContext(),
    );
    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).not.toContain("color=white");

    mock.mockReset();
    mock.respondJson({ puzzles: [] });
    await findTool("play_puzzle").handler(
      { rated: true, nb: 1, color: "white" },
      makeContext(),
    );
    const [url2] = mock.mock.calls[0] as [string, unknown];
    expect(url2).toContain("color=white");
  });
});
