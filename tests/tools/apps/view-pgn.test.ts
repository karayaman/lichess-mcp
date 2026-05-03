import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  lichessUrl,
} from "../../helpers/mock.js";
import type { UiToolResult, PgnProps } from "../../../src/types/ui-props.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

const SAMPLE_PGN = `[Event "World Championship"]
[Site "London"]
[Date "2024.12.01"]
[White "Carlsen, M"]
[Black "Nepomniachtchi, I"]
[WhiteElo "2830"]
[BlackElo "2790"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0
`;

describe("view_pgn", () => {
  it("is registered with a UI descriptor", () => {
    const t = findTool("view_pgn");
    expect(t.ui).toEqual({
      resourceUri: "ui://lichess-mcp/pgn.html",
      htmlFile: "pgn.html",
    });
  });

  it("uses the provided PGN verbatim without fetching", async () => {
    const mock = installFetchMock();

    const result = (await findTool("view_pgn").handler(
      { pgn: SAMPLE_PGN },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    expect(mock).not.toHaveBeenCalled();
    expect(result.__uiResult).toBe(true);
    expect(result.props.pgn).toBe(SAMPLE_PGN);
    expect(result.props.lichessUrl).toBeNull();
  });

  it("fetches /game/export/{gameId} when only gameId provided", async () => {
    const mock = installFetchMock();
    mock.respondPgn(SAMPLE_PGN);

    const result = (await findTool("view_pgn").handler(
      { gameId: "abc12345" },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(lichessUrl("/game/export/abc12345"));
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
    expect(result.props.pgn).toBe(SAMPLE_PGN);
    expect(result.props.lichessUrl).toBe("https://lichess.org/abc12345");
  });

  it("extracts standard PGN headers", async () => {
    const result = (await findTool("view_pgn").handler(
      { pgn: SAMPLE_PGN },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    expect(result.props.headers.event).toBe("World Championship");
    expect(result.props.headers.white).toBe("Carlsen, M");
    expect(result.props.headers.black).toBe("Nepomniachtchi, I");
    expect(result.props.headers.whiteElo).toBe("2830");
    expect(result.props.headers.blackElo).toBe("2790");
    expect(result.props.headers.result).toBe("1-0");
    expect(result.props.headers.date).toBe("2024.12.01");
    expect(result.props.headers.site).toBe("London");
  });

  it("extracts FEN and SetUp headers for setup-position PGNs", async () => {
    const setupPgn = `[Event "Endgame Study"]
[SetUp "1"]
[FEN "8/8/8/8/8/4k3/4P3/4K3 w - - 0 1"]

1. Kd1 Kf4 *
`;

    const result = (await findTool("view_pgn").handler(
      { pgn: setupPgn },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    expect(result.props.headers.setup).toBe("1");
    expect(result.props.headers.fen).toBe("8/8/8/8/8/4k3/4P3/4K3 w - - 0 1");
  });

  it("text fallback includes player names, result, and the PGN body", async () => {
    const result = (await findTool("view_pgn").handler(
      { gameId: "abc12345", pgn: SAMPLE_PGN },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    expect(result.text).toContain("Carlsen, M (2830) vs Nepomniachtchi, I (2790)");
    expect(result.text).toContain("Result: 1-0");
    expect(result.text).toContain("https://lichess.org/abc12345");
    expect(result.text).toContain("1. e4 e5");
  });

  it("truncates long PGN text fallback to 800 chars + ellipsis", async () => {
    const longPgn = `[Event "${"Long Match ".repeat(100)}"]
[Result "1-0"]

1. e4 e5 1-0
`;

    const result = (await findTool("view_pgn").handler(
      { pgn: longPgn },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    expect(result.text).toContain("…");
  });

  it("rejects when neither gameId nor pgn is provided", () => {
    const t = findTool("view_pgn");
    expect(() => t.schema.parse({})).toThrow();
  });

  it("normalizes a path with perspective suffix to the bare 8-char id", async () => {
    const mock = installFetchMock();
    mock.respondPgn(SAMPLE_PGN);

    await findTool("view_pgn").handler(
      { gameId: "AxGa6qxX/black" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(lichessUrl("/game/export/AxGa6qxX"));
  });

  it("normalizes a full Lichess URL to the bare id", async () => {
    const mock = installFetchMock();
    mock.respondPgn(SAMPLE_PGN);

    const result = (await findTool("view_pgn").handler(
      { gameId: "https://lichess.org/AxGa6qxX/black" },
      makeContext(),
    )) as UiToolResult<PgnProps>;

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(lichessUrl("/game/export/AxGa6qxX"));
    expect(result.props.lichessUrl).toBe("https://lichess.org/AxGa6qxX");
  });

  it("accepts the 12-char full id and uses its 8-char prefix", async () => {
    const mock = installFetchMock();
    mock.respondPgn(SAMPLE_PGN);

    await findTool("view_pgn").handler(
      { gameId: "AxGa6qxXuvwX" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(lichessUrl("/game/export/AxGa6qxX"));
  });

  it("rejects malformed game ids with a clear error", async () => {
    await expect(
      findTool("view_pgn").handler({ gameId: "not-a-real-id!" }, makeContext()),
    ).rejects.toThrow(/not a Lichess game id/);
  });

  it("rejects a malformed raw PGN with a parse error and variant hint", async () => {
    await expect(
      findTool("view_pgn").handler(
        { pgn: '[Event "x"]\n1. zz' },
        makeContext(),
      ),
    ).rejects.toThrow(/Could not parse PGN.*standard chess and Chess960/s);
  });

  it("names the game id when a fetched PGN fails to parse", async () => {
    const mock = installFetchMock();
    mock.respondPgn('[Event "x"]\n1. zz');

    await expect(
      findTool("view_pgn").handler({ gameId: "abc12345" }, makeContext()),
    ).rejects.toThrow(/Could not parse PGN for abc12345/);
  });
});
