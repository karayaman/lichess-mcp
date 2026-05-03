import { AnyToolDefinition } from "../../registry.js";
import { exploreOpenings } from "./explore-openings.js";
import { playPuzzle } from "./play-puzzle.js";
import { submitPuzzleBatch } from "./submit-puzzle-batch.js";
import { viewPgn } from "./view-pgn.js";

/**
 * Interactive UI tools registered as MCP Apps. Each renders an iframe in
 * MCP-Apps-capable hosts (e.g. Claude Desktop) and falls back to the text
 * `content` field for clients without UI support.
 *
 * `submitPuzzleBatch` is an iframe-only callback: it carries
 * `ui: { visibility: ["app"] }` so MCP-Apps hosts hide it from the model and
 * only the play_puzzle iframe can invoke it via callServerTool.
 */
export const appTools: AnyToolDefinition[] = [
  playPuzzle,
  viewPgn,
  exploreOpenings,
  submitPuzzleBatch,
];
