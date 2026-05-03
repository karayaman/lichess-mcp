import { z } from "zod";
import { Chess } from "chess.js";
import { tool } from "../../registry.js";
import type {
  PgnHeaders,
  PgnProps,
  UiToolResult,
} from "../../types/ui-props.js";

const HEADER_RE = /^\[(\w+)\s+"([^"]*)"\]/;

/**
 * Extract a Lichess game id from a bare id, a path with a perspective suffix
 * (`AxGa6qxX/black`), or a full URL (`https://lichess.org/AxGa6qxX/black`).
 * Lichess game ids are 8 alphanumeric chars (short form) or 12 (full form).
 */
function normalizeGameId(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^(www\.)?lichess\.org\//i, "");
  s = s.split(/[/?#]/, 1)[0];
  if (!/^[A-Za-z0-9]{8}([A-Za-z0-9]{4})?$/.test(s)) {
    throw new Error(
      `"${input}" is not a Lichess game id or URL — expected the 8-character id (e.g. AxGa6qxX) or a full https://lichess.org/<id> URL`,
    );
  }
  return s.slice(0, 8);
}

function extractHeaders(pgn: string): PgnHeaders {
  const headers: PgnHeaders = {};
  for (const line of pgn.split(/\r?\n/)) {
    const m = HEADER_RE.exec(line.trim());
    if (!m) {
      if (line.trim().length === 0 && Object.keys(headers).length > 0) break;
      continue;
    }
    const [, tag, value] = m;
    switch (tag) {
      case "White": headers.white = value; break;
      case "Black": headers.black = value; break;
      case "WhiteElo": headers.whiteElo = value; break;
      case "BlackElo": headers.blackElo = value; break;
      case "Event": headers.event = value; break;
      case "Site": headers.site = value; break;
      case "Date": headers.date = value; break;
      case "Result": headers.result = value; break;
      case "FEN": headers.fen = value; break;
      case "SetUp": headers.setup = value; break;
    }
  }
  return headers;
}

export const viewPgn = tool({
  name: "view_pgn",
  description:
    "Open an interactive PGN viewer in Claude Desktop with a real chess board, prev/next/play controls, and clickable move list. Provide either gameId (Lichess game) or a raw PGN string.",
  schema: z
    .object({
      gameId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "Lichess game id (8 chars, e.g. AxGa6qxX). A full URL like https://lichess.org/AxGa6qxX/black is also accepted and normalized.",
        ),
      pgn: z.string().trim().min(1).optional().describe("Raw PGN to view."),
    })
    .refine((v) => Boolean(v.gameId || v.pgn), {
      message: "Provide either gameId or pgn",
    }),
  ui: {
    resourceUri: "ui://lichess-mcp/pgn.html",
    htmlFile: "pgn.html",
  },
  handler: async ({ gameId, pgn }, { client }) => {
    const id = gameId ? normalizeGameId(gameId) : null;
    // /game/export/{id} lives at the site root, NOT under /api — sending it to
    // /api/game/export/{id} returns 404. Override the base URL for this call.
    const text =
      pgn ??
      (await client.pgn(`/game/export/${id}`, { baseUrl: "https://lichess.org" }));
    // Probe-parse before sending props to the iframe — chess.js@1 throws on
    // invalid PGN, and the iframe's loadPgn would otherwise reject module
    // evaluation and leave a blank panel. Common cause: Lichess variant games
    // (Crazyhouse, Atomic, Antichess, etc.) which chess.js can't parse.
    try {
      new Chess().loadPgn(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not parse PGN${id ? ` for ${id}` : ""}: ${reason}. ` +
          `Only standard chess and Chess960 PGNs are supported.`,
      );
    }

    const headers = extractHeaders(text);
    const lichessUrl = id ? `https://lichess.org/${id}` : null;

    const props: PgnProps = { pgn: text, headers, lichessUrl };

    const lines: string[] = [];
    if (headers.event) lines.push(headers.event);
    if (headers.white || headers.black) {
      const w = headers.white ?? "?";
      const b = headers.black ?? "?";
      const wElo = headers.whiteElo ? ` (${headers.whiteElo})` : "";
      const bElo = headers.blackElo ? ` (${headers.blackElo})` : "";
      lines.push(`${w}${wElo} vs ${b}${bElo}`);
    }
    if (headers.date) lines.push(headers.date);
    if (headers.result) lines.push(`Result: ${headers.result}`);
    if (lichessUrl) lines.push(lichessUrl);
    lines.push("");
    lines.push(text.length > 800 ? text.slice(0, 800) + "…" : text);

    const result: UiToolResult<PgnProps> = {
      __uiResult: true,
      text: lines.join("\n"),
      props,
    };
    return result;
  },
});
