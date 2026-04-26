import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

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
  description: "Get all TV channels and their current games",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/tv/channels"),
});

const getTvGame = tool({
  name: "get_tv_game",
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
  description: "Stream positions and moves of the current TV game (returns first chunk)",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    const response = await client.request("/tv/feed", { auth: false });
    const text = await response.text();
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine ? (JSON.parse(firstLine) as object) : {};
  },
});

const getTvChannelFeed = tool({
  name: "get_tv_channel_feed",
  description: "Stream positions and moves of the current game of a TV channel (returns first chunk)",
  schema: z.object({
    channel: z.enum(TV_CHANNELS).describe("TV channel name"),
  }),
  handler: async ({ channel }, { client }) => {
    const response = await client.request(`/tv/${encodeURIComponent(channel)}/feed`, {
      auth: false,
    });
    const text = await response.text();
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine ? (JSON.parse(firstLine) as object) : {};
  },
});

export const tvTools: AnyToolDefinition[] = [getTvChannels, getTvGame, getTvFeed, getTvChannelFeed];
