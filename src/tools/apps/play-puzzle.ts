import { z } from "zod";
import { Chess } from "chess.js";
import { tool } from "../../registry.js";
import type {
  Color,
  PuzzleProps,
  PuzzleSpec,
  UiToolResult,
} from "../../types/ui-props.js";

interface LichessPuzzlePayload {
  game?: { id?: string; pgn?: string };
  puzzle?: {
    id?: string;
    initialPly?: number;
    fen?: string;
    solution?: string[];
    themes?: string[];
    rating?: number;
  };
}

interface PuzzleBatchResponse {
  puzzles?: LichessPuzzlePayload[];
}

/**
 * Replay the game's PGN to the position the puzzle starts from.
 *
 * Lichess convention: `initialPly` is the index of the LAST played half-move
 * before the user's first move. The opponent has just moved, and now it's
 * the user's turn — so the side to move at this FEN is the user's color.
 */
function fenAtPuzzleStart(
  pgn: string,
  initialPly: number,
  puzzleId: string,
): { fen: string; color: Color } {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Puzzle ${puzzleId} has an invalid PGN: ${reason}`);
  }
  const history = chess.history({ verbose: true });
  const replay = new Chess();
  for (let i = 0; i < initialPly + 1 && i < history.length; i++) {
    replay.move({
      from: history[i].from,
      to: history[i].to,
      promotion: history[i].promotion,
    });
  }
  const fen = replay.fen();
  const color: Color = fen.split(" ")[1] === "w" ? "white" : "black";
  return { fen, color };
}

function specFromPayload(payload: LichessPuzzlePayload, fallbackId = "puzzle"): PuzzleSpec {
  const id = payload.puzzle?.id ?? fallbackId;
  const solution = payload.puzzle?.solution ?? [];
  const themes = payload.puzzle?.themes ?? [];
  const rating = payload.puzzle?.rating ?? null;
  const lichessUrl = `https://lichess.org/training/${id}`;

  let fen: string;
  let orientation: Color;
  if (payload.puzzle?.fen) {
    fen = payload.puzzle.fen;
    orientation = fen.split(" ")[1] === "w" ? "white" : "black";
  } else {
    const pgn = payload.game?.pgn ?? "";
    const initialPly = payload.puzzle?.initialPly ?? 0;
    ({ fen, color: orientation } = fenAtPuzzleStart(pgn, initialPly, id));
  }

  return { puzzleId: id, fen, solution, orientation, themes, rating, lichessUrl };
}

export const playPuzzle = tool({
  name: "play_puzzle",
  description:
    "Open an interactive chess puzzle in Claude Desktop. Drag pieces to solve; the UI validates each move against the Lichess solution and auto-plays the opponent's reply. " +
    "Default: today's daily puzzle. Use {next:true} for an unseen puzzle, {puzzleId} for a specific one, or {rated:true, nb:N, angle:'mix'} to start a RATED batch session that updates your Lichess puzzle rating when completed.",
  schema: z.object({
    puzzleId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Lichess puzzle id."),
    next: z
      .boolean()
      .optional()
      .describe(
        "Fetch a fresh non-daily puzzle (Lichess /puzzle/next). Used by the iframe's Next button.",
      ),
    rated: z
      .boolean()
      .optional()
      .describe(
        "Start a rated batch session. The iframe walks through `nb` puzzles, then submits the results to /puzzle/batch/{angle} so they affect your Lichess rating. Requires the puzzle:write OAuth scope.",
      ),
    angle: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Theme/angle for the batch (default: 'mix'). Only used in rated mode."),
    nb: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Number of puzzles in the rated batch (default: 10, max 50)."),
    difficulty: z
      .enum(["easiest", "easier", "normal", "harder", "hardest"])
      .optional()
      .describe("Difficulty band relative to the user's current rating (rated mode only)."),
    color: z
      .enum(["white", "black"])
      .optional()
      .describe("Force playing as a single color (only honored when nb=1)."),
  }),
  ui: {
    resourceUri: "ui://lichess-mcp/puzzle.html",
    htmlFile: "puzzle.html",
  },
  handler: async (args, { client }) => {
    if (args.rated) {
      const angle = args.angle ?? "mix";
      const nb = args.nb ?? 10;
      const params = new URLSearchParams();
      params.set("nb", String(nb));
      if (args.difficulty) params.set("difficulty", args.difficulty);
      if (args.color && nb === 1) params.set("color", args.color);
      const data = await client.json<PuzzleBatchResponse>(
        `/puzzle/batch/${encodeURIComponent(angle)}?${params.toString()}`,
      );
      const puzzles = (data.puzzles ?? []).map((p, i) =>
        specFromPayload(p, `${angle}-${i}`),
      );

      const props: PuzzleProps = {
        puzzles,
        session: { angle, rated: true },
      };
      const text = [
        `Rated batch: ${puzzles.length} puzzle${puzzles.length === 1 ? "" : "s"} (angle ${angle}).`,
        `Solve them in the interactive UI to update your Lichess puzzle rating.`,
        ...puzzles.map(
          (p, i) =>
            `  ${i + 1}. ${p.puzzleId}${p.rating ? ` (${p.rating})` : ""} — ${p.lichessUrl}`,
        ),
      ].join("\n");

      const result: UiToolResult<PuzzleProps> = { __uiResult: true, text, props };
      return result;
    }

    // Single-puzzle mode (daily / next / by-id).
    const path = args.puzzleId
      ? `/puzzle/${encodeURIComponent(args.puzzleId)}`
      : args.next
        ? "/puzzle/next"
        : "/puzzle/daily";
    const data = await client.json<LichessPuzzlePayload>(path);
    const spec = specFromPayload(data, args.puzzleId ?? "daily");

    const props: PuzzleProps = {
      puzzles: [spec],
      session: { angle: "", rated: false },
    };
    const text = [
      `Puzzle ${spec.puzzleId}${spec.rating ? ` (rating ${spec.rating})` : ""}.`,
      spec.themes.length ? `Themes: ${spec.themes.join(", ")}.` : "",
      `Open: ${spec.lichessUrl}`,
      `FEN: ${spec.fen}`,
      `Solution (UCI): ${spec.solution.join(" ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result: UiToolResult<PuzzleProps> = { __uiResult: true, text, props };
    return result;
  },
});
