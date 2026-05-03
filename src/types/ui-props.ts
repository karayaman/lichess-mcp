/**
 * Shape of `_meta["modelcontextprotocol.io/ui"].props` we ship from each app
 * tool result. Imported by both server-side handlers and iframe `main.ts`
 * files (via tsconfig.ui.json) so the contract is enforced on both ends.
 */

export type Color = "white" | "black";

export interface PuzzlePgnGame {
  /** Lichess game id (8 chars). */
  id?: string;
  /** Full game PGN played up to (and including) the puzzle's setup move. */
  pgn: string;
}

export interface PuzzleSpec {
  puzzleId: string;
  /** FEN of the position the user faces (after the opponent's setup move). */
  fen: string;
  /** Solution moves in UCI form (alternating user / opponent). */
  solution: string[];
  /** Side the user plays. */
  orientation: Color;
  themes: string[];
  rating: number | null;
  lichessUrl: string;
}

export interface PuzzleSession {
  /** Theme/angle for the batch (e.g. "mix", "endgame"). Empty for single mode. */
  angle: string;
  /** When true, completing the batch submits results to update Lichess rating. */
  rated: boolean;
}

export interface PuzzleProps {
  /** Puzzle queue. Length 1 in single mode, N in rated batch mode. */
  puzzles: PuzzleSpec[];
  session: PuzzleSession;
}

export interface PuzzleRound {
  id: string;
  win: boolean;
  ratingDiff: number;
}

export interface PuzzleSubmitResult {
  rounds: PuzzleRound[];
  glicko: { rating: number; deviation: number } | null;
}

export interface PgnHeaders {
  white?: string;
  black?: string;
  whiteElo?: string;
  blackElo?: string;
  event?: string;
  site?: string;
  date?: string;
  result?: string;
  fen?: string;
  setup?: string;
}

export interface PgnProps {
  pgn: string;
  headers: PgnHeaders;
  lichessUrl: string | null;
}

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
  averageOpponentRating?: number;
}

export interface ExplorerGame {
  id?: string;
  uci?: string;
  winner?: "white" | "black" | null;
  white: { name?: string; rating?: number };
  black: { name?: string; rating?: number };
  year?: number;
  month?: string;
}

export interface ExplorerData {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  topGames?: ExplorerGame[];
  recentGames?: ExplorerGame[];
  opening?: { eco?: string; name?: string } | null;
}

export type ExplorerSource = "masters" | "lichess";

export interface OpeningsProps {
  /** FEN the play history is rooted at. */
  rootFen: string;
  /** Comma-separated UCI moves played from rootFen. May be empty. */
  play: string;
  /** Current position FEN (rootFen with `play` applied). */
  currentFen: string;
  source: ExplorerSource;
  initialData: ExplorerData;
}

/** Discriminator returned by app-tool handlers (consumed by server.ts). */
export interface UiToolResult<P> {
  __uiResult: true;
  text: string;
  props: P;
}

export const UI_META_KEY = "modelcontextprotocol.io/ui";
