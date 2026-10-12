import { z } from "zod";
import { AnyToolDefinition, tool, READ_ONLY } from "../registry.js";

const TV_CHANNELS = [
  "bot",
  "blitz",
  "racingKings",
  "ultraBullet",
  "bullet",
  "classical",
  "threeCheck",
  "antichess",
  "computer",
  "horde",
  "rapid",
  "atomic",
  "crazyhouse",
  "chess960",
  "kingOfTheHill",
  "best",
] as const;

const getTvChannels = tool({
  name: "get_tv_channels",
  annotations: READ_ONLY,
  description: "Get all TV channels and their current games",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/tv/channels"),
});

const getTvGame = tool({
  name: "get_tv_game",
  annotations: READ_ONLY,
  description: "Get current TV game in PGN format",
  schema: z.object({
    channel: z
      .enum(TV_CHANNELS)
      .optional()
      .describe("Channel name like 'bot', 'blitz', etc."),
  }),
  handler: async ({ channel }, { client }) => {
    const path = channel ? `/tv/${channel}` : "/tv";
    const result = await client.pgnOrJson(path);
    return result.kind === "pgn" ? result.pgn : (result.data as object);
  },
});

const getTvFeed = tool({
  name: "get_tv_feed",
  annotations: READ_ONLY,
  description: "Stream positions and moves of the current TV game (returns first chunk)",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    return (await client.firstStreamEvent<object>("/tv/feed", { auth: false })) ?? {};
  },
});

const getTvChannelFeed = tool({
  name: "get_tv_channel_feed",
  annotations: READ_ONLY,
  description: "Stream positions and moves of the current game of a TV channel (returns first chunk)",
  schema: z.object({
    channel: z.enum(TV_CHANNELS).describe("TV channel name"),
  }),
  handler: async ({ channel }, { client }) => {
    return (await client.firstStreamEvent<object>(`/tv/${encodeURIComponent(channel)}/feed`, {
      auth: false,
    })) ?? {};
  },
});

export const tvTools: AnyToolDefinition[] = [getTvChannels, getTvGame, getTvFeed, getTvChannelFeed];
