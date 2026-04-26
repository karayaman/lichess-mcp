import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";
import { LichessClient } from "../http/client.js";
import { parseNdjson } from "../http/parse.js";

const PERF_TYPES = [
  "ultraBullet",
  "bullet",
  "blitz",
  "rapid",
  "classical",
  "correspondence",
  "chess960",
  "crazyhouse",
  "antichess",
  "atomic",
  "horde",
  "kingOfTheHill",
  "racingKings",
  "threeCheck",
] as const;

const MIN_LICHESS_TIMESTAMP = 1356998400070; // 2013-01-01 — Lichess birthday.

/** Append every key/value in `flags` to `params` as "true"/"false" strings, skipping undefined. */
function appendBooleanParams(
  params: URLSearchParams,
  flags: Record<string, boolean | undefined>,
): void {
  for (const [key, value] of Object.entries(flags)) {
    if (value !== undefined) params.append(key, String(value));
  }
}

async function pgnOrJsonToText(
  client: LichessClient,
  path: string,
): Promise<string> {
  const result = await client.pgnOrJson(path);
  return result.kind === "pgn" ? result.pgn : JSON.stringify(result.data, null, 2);
}

const exportGameSchema = z.object({
  gameId: z.string().length(8).describe("The game ID"),
  moves: z.boolean().optional().describe("Include the PGN moves"),
  pgnInJson: z.boolean().optional().describe("Include the full PGN within the JSON response"),
  tags: z.boolean().optional().describe("Include the PGN tags"),
  clocks: z.boolean().optional().describe("Include clock comments in the PGN moves"),
  evals: z.boolean().optional().describe("Include analysis evaluation comments"),
  accuracy: z.boolean().optional().describe("Include accuracy percentages"),
  opening: z.boolean().optional().describe("Include opening name"),
  literate: z.boolean().optional().describe("Include textual annotations"),
});

const exportGame = tool({
  name: "export_game",
  description: "Export one game in PGN or JSON format",
  schema: exportGameSchema,
  handler: async ({ gameId, ...flags }, { client }) => {
    const params = new URLSearchParams();
    appendBooleanParams(params, flags);
    return pgnOrJsonToText(client, `/game/export/${gameId}?${params.toString()}`);
  },
});

const exportOngoingGame = tool({
  name: "export_ongoing_game",
  description: "Export the ongoing game of a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("The username"),
    moves: z.boolean().optional(),
    pgnInJson: z.boolean().optional(),
    tags: z.boolean().optional(),
    clocks: z.boolean().optional(),
    evals: z.boolean().optional(),
    opening: z.boolean().optional(),
  }),
  handler: async ({ username, ...flags }, { client }) => {
    const params = new URLSearchParams();
    appendBooleanParams(params, flags);
    return pgnOrJsonToText(
      client,
      `/user/${encodeURIComponent(username)}/current-game?${params.toString()}`,
    );
  },
});

const exportUserGames = tool({
  name: "export_user_games",
  description: "Export all games of a user (PGN or NDJSON)",
  schema: z.object({
    username: z.string().trim().min(1),
    since: z
      .number()
      .int()
      .min(MIN_LICHESS_TIMESTAMP, "Since timestamp must be after January 1, 2013")
      .optional(),
    until: z
      .number()
      .int()
      .min(MIN_LICHESS_TIMESTAMP, "Until timestamp must be after January 1, 2013")
      .optional(),
    max: z.number().int().min(1).optional(),
    vs: z.string().optional(),
    rated: z.boolean().optional(),
    perfType: z.enum(PERF_TYPES).optional(),
    color: z.enum(["white", "black"]).optional(),
    analysed: z.boolean().optional(),
    moves: z.boolean().optional(),
    tags: z.boolean().optional(),
    clocks: z.boolean().optional(),
    evals: z.boolean().optional(),
    accuracy: z.boolean().optional(),
    opening: z.boolean().optional(),
    ongoing: z.boolean().optional(),
    finished: z.boolean().optional(),
    literate: z.boolean().optional(),
    lastFen: z.boolean().optional(),
    sort: z.enum(["dateAsc", "dateDesc"]).optional(),
  }),
  handler: async ({ username, ...rest }, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) params.append(key, String(value));
    }
    const response = await client.request(
      `/games/user/${encodeURIComponent(username)}?${params.toString()}`,
    );
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-chess-pgn")) {
      return await response.text();
    }
    if (contentType.includes("application/x-ndjson")) {
      return await parseNdjson(response);
    }
    return (await response.json()) as object;
  },
});

const exportGamesByIds = tool({
  name: "export_games_by_ids",
  description: "Export multiple games by IDs (POST body)",
  schema: z.object({
    ids: z
      .string()
      .trim()
      .min(1)
      .describe("Game IDs separated by commas. Up to 300.")
      .refine((s) => s.split(",").length <= 300, "Maximum of 300 game IDs allowed"),
    moves: z.boolean().optional(),
    pgnInJson: z.boolean().optional(),
    tags: z.boolean().optional(),
    clocks: z.boolean().optional(),
    evals: z.boolean().optional(),
    opening: z.boolean().optional(),
  }),
  handler: async ({ ids, ...flags }, { client }) => {
    const params = new URLSearchParams();
    appendBooleanParams(params, flags);
    const path = params.toString() ? `/games/export/_ids?${params.toString()}` : "/games/export/_ids";
    const response = await client.postText(path, ids, "text/plain");
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-chess-pgn")) {
      return await response.text();
    }
    if (contentType.includes("application/x-ndjson")) {
      return await parseNdjson(response);
    }
    return (await response.json()) as object;
  },
});

const getOngoingGames = tool({
  name: "get_ongoing_games",
  description: "Get your ongoing games (real-time and correspondence)",
  schema: z.object({
    nb: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(9)
      .describe("Number of ongoing games to fetch (1-50)"),
  }),
  handler: async ({ nb }, { client }) => client.json(`/account/playing?nb=${nb}`),
});

const getGameChat = tool({
  name: "get_game_chat",
  description: "Get the chat messages of a game",
  schema: z.object({
    gameId: z.string().trim().min(1).describe("The game ID"),
  }),
  handler: async ({ gameId }, { client }) =>
    client.json(`/game/${encodeURIComponent(gameId)}/chat`),
});

const importGame = tool({
  name: "import_game",
  description: "Import a game from PGN",
  schema: z.object({
    pgn: z.string().trim().min(1).describe("PGN of the game"),
  }),
  handler: async ({ pgn }, { client }) => {
    const response = await client.postForm("/import", { pgn });
    return (await response.json()) as object;
  },
});

const getImportedGames = tool({
  name: "get_imported_games",
  description: "Export games imported by the logged-in user",
  schema: z.object({}),
  handler: async (_args, { client }) =>
    client.json("/games/export/imports"),
});

const getBookmarkedGames = tool({
  name: "get_bookmarked_games",
  description: "Export games bookmarked by the logged-in user",
  schema: z.object({}),
  handler: async (_args, { client }) =>
    client.json("/games/export/bookmarks"),
});

export const gamesTools: AnyToolDefinition[] = [
  exportGame,
  exportOngoingGame,
  exportUserGames,
  exportGamesByIds,
  getOngoingGames,
  getGameChat,
  importGame,
  getImportedGames,
  getBookmarkedGames,
];
