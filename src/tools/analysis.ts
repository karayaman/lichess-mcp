import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const getCloudEval = tool({
  name: "get_cloud_eval",
  description: "Get cloud evaluation for a position",
  schema: z.object({
    fen: z.string().trim().min(1).describe("FEN of the position to analyze"),
    multiPv: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(1)
      .describe("Number of principal variations (1-5)"),
  }),
  handler: async ({ fen, multiPv }, { client }) => {
    const params = new URLSearchParams({ fen, multiPv: String(multiPv) });
    return client.json(`/cloud-eval?${params.toString()}`);
  },
});

const getFidePlayer = tool({
  name: "get_fide_player",
  description: "Get FIDE player information",
  schema: z.object({
    playerId: z.string().trim().min(1).describe("FIDE player ID"),
  }),
  handler: async ({ playerId }, { client }) =>
    client.json(`/fide/player/${encodeURIComponent(playerId)}`),
});

const searchFidePlayers = tool({
  name: "search_fide_players",
  description: "Search FIDE players by name",
  schema: z.object({
    name: z.string().trim().min(1).describe("Name of the player to search"),
  }),
  handler: async ({ name }, { client }) =>
    client.json(`/fide/player?q=${encodeURIComponent(name)}`),
});

const getFidePlayerRatings = tool({
  name: "get_fide_player_ratings",
  description: "Get rating history for a FIDE player",
  schema: z.object({
    playerId: z.string().trim().min(1).describe("FIDE player ID"),
  }),
  handler: async ({ playerId }, { client }) =>
    client.json(`/fide/player/${encodeURIComponent(playerId)}/ratings`),
});

export const analysisTools: AnyToolDefinition[] = [
  getCloudEval,
  getFidePlayer,
  searchFidePlayers,
  getFidePlayerRatings,
];
