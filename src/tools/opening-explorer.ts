import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const EXPLORER_BASE = "https://explorer.lichess.org";

const getMastersOpenings = tool({
  name: "get_masters_openings",
  description: "Get opening positions from master (OTB) games",
  schema: z.object({
    fen: z.string().optional().describe("FEN of the position (default: starting position)"),
    play: z.string().optional().describe("Comma-separated list of moves (UCI) from the FEN"),
    since: z.string().optional().describe("Year (YYYY) — only include games since this year"),
    until: z.string().optional().describe("Year (YYYY) — only include games up to this year"),
    moves: z.number().int().min(1).optional().describe("Number of most-played moves to return"),
    topGames: z.number().int().min(0).optional().describe("Number of top games to return"),
  }),
  handler: async ({ fen, play, since, until, moves, topGames }, { client }) => {
    const params = new URLSearchParams();
    if (fen) params.set("fen", fen);
    if (play) params.set("play", play);
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    if (moves !== undefined) params.set("moves", String(moves));
    if (topGames !== undefined) params.set("topGames", String(topGames));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.json(`/masters${qs}`, { baseUrl: EXPLORER_BASE });
  },
});

const getLichessOpenings = tool({
  name: "get_lichess_openings",
  description: "Get opening positions from Lichess games",
  schema: z.object({
    variant: z.string().optional().describe("Chess variant"),
    fen: z.string().optional().describe("FEN of the position"),
    play: z.string().optional().describe("Comma-separated moves (UCI) from the FEN"),
    speeds: z.string().optional().describe("Comma-separated speed categories (bullet, blitz, rapid, classical)"),
    ratings: z.string().optional().describe("Comma-separated rating bands (e.g. 1600,1800,2000)"),
    since: z.string().optional().describe("Month (YYYY-MM)"),
    until: z.string().optional().describe("Month (YYYY-MM)"),
    moves: z.number().int().min(1).optional().describe("Number of most-played moves to return"),
    topGames: z.number().int().min(0).optional().describe("Number of top games"),
    recentGames: z.number().int().min(0).optional().describe("Number of recent games"),
    history: z.boolean().optional().describe("Include history data"),
  }),
  handler: async (args, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.json(`/lichess${qs}`, { baseUrl: EXPLORER_BASE });
  },
});

const getPlayerOpenings = tool({
  name: "get_player_openings",
  description: "Get opening statistics for a specific Lichess player",
  schema: z.object({
    player: z.string().trim().min(1).describe("Lichess username"),
    color: z.enum(["white", "black"]).describe("Color to view statistics for"),
    variant: z.string().optional(),
    fen: z.string().optional(),
    play: z.string().optional(),
    speeds: z.string().optional(),
    modes: z.string().optional().describe("Comma-separated modes (rated, casual)"),
    since: z.string().optional(),
    until: z.string().optional(),
    moves: z.number().int().min(1).optional(),
    recentGames: z.number().int().min(0).optional(),
  }),
  handler: async (args, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return client.ndjson(`/player?${params.toString()}`, { baseUrl: EXPLORER_BASE });
  },
});

const getMasterGame = tool({
  name: "get_master_game",
  description: "Get a master game from the opening explorer (returns PGN)",
  schema: z.object({
    gameId: z.string().trim().min(1).describe("The game ID"),
  }),
  handler: async ({ gameId }, { client }) =>
    client.pgn(`/masters/pgn/${encodeURIComponent(gameId)}`, { baseUrl: EXPLORER_BASE }),
});

export const openingExplorerTools: AnyToolDefinition[] = [
  getMastersOpenings,
  getLichessOpenings,
  getPlayerOpenings,
  getMasterGame,
];
