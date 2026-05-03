import { z } from "zod";
import { Chess } from "chess.js";
import { tool } from "../../registry.js";
import {
  fetchLichessExplorer,
  fetchMastersExplorer,
} from "../opening-explorer.js";
import type {
  ExplorerData,
  ExplorerSource,
  OpeningsProps,
  UiToolResult,
} from "../../types/ui-props.js";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function applyPlay(rootFen: string, play: string): string {
  if (!play) return rootFen;
  const chess = new Chess(rootFen);
  for (const uci of play.split(",")) {
    if (!uci) continue;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
    const move = chess.move({ from, to, promotion });
    if (!move) throw new Error(`Illegal move in play: ${uci}`);
  }
  return chess.fen();
}

function summarizeText(data: ExplorerData, source: ExplorerSource): string {
  const total = data.white + data.draws + data.black;
  const lines: string[] = [];
  if (data.opening?.name) lines.push(`Opening: ${data.opening.name}`);
  lines.push(`Source: ${source} · ${total.toLocaleString()} games`);
  lines.push(`White ${data.white} · Draws ${data.draws} · Black ${data.black}`);
  lines.push("");
  lines.push("Top moves:");
  const top = (data.moves ?? []).slice(0, 5);
  for (const m of top) {
    const t = m.white + m.draws + m.black;
    const pct = (n: number) => (t === 0 ? 0 : Math.round((n / t) * 100));
    lines.push(
      `  ${m.san.padEnd(7)} ${t.toLocaleString().padStart(8)}  ` +
        `W ${pct(m.white)}% · D ${pct(m.draws)}% · B ${pct(m.black)}%`,
    );
  }
  return lines.join("\n");
}

export const exploreOpenings = tool({
  name: "explore_openings",
  description:
    "Open an interactive opening explorer in Claude Desktop. Click moves on the board or in the move list to drill down; switch between Masters (OTB) and Lichess game databases. Defaults to the starting position.",
  schema: z.object({
    fen: z
      .string()
      .optional()
      .describe("Root position FEN (default: starting position)."),
    play: z
      .string()
      .optional()
      .describe("Comma-separated UCI moves to apply from `fen`."),
    source: z
      .enum(["masters", "lichess"])
      .default("masters")
      .describe("Which game database to query."),
  }),
  ui: {
    resourceUri: "ui://lichess-mcp/openings.html",
    htmlFile: "openings.html",
  },
  handler: async ({ fen, play, source }, { client }) => {
    const rootFen = fen ?? STARTING_FEN;
    const playStr = play ?? "";
    const currentFen = applyPlay(rootFen, playStr);

    const initialData =
      source === "lichess"
        ? await fetchLichessExplorer<ExplorerData>(
            { fen: rootFen, play: playStr, moves: 12, topGames: 4 },
            client,
          )
        : await fetchMastersExplorer<ExplorerData>(
            { fen: rootFen, play: playStr, moves: 12, topGames: 4 },
            client,
          );

    const props: OpeningsProps = {
      rootFen,
      play: playStr,
      currentFen,
      source,
      initialData,
    };

    const result: UiToolResult<OpeningsProps> = {
      __uiResult: true,
      text: summarizeText(initialData, source),
      props,
    };
    return result;
  },
});
