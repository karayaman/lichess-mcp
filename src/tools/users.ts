import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const PERF_TYPES = [
  "ultraBullet",
  "bullet",
  "blitz",
  "rapid",
  "classical",
  "chess960",
  "crazyhouse",
  "antichess",
  "atomic",
  "horde",
  "kingOfTheHill",
  "racingKings",
  "threeCheck",
] as const;

const getUsersStatus = tool({
  name: "get_users_status",
  description: "Get real-time status of multiple users",
  schema: z.object({
    ids: z
      .string()
      .min(1)
      .describe("Comma-separated user IDs (max 100)")
      .refine((s) => s.split(",").length <= 100, "Maximum of 100 user IDs allowed"),
    withSignal: z.boolean().optional().describe("Include connection signal level"),
    withGameIds: z.boolean().optional().describe("Include current game IDs"),
    withGameMetas: z.boolean().optional().describe("Include current game metadata"),
  }),
  handler: async ({ ids, withSignal, withGameIds, withGameMetas }, { client }) => {
    const params = new URLSearchParams({ ids });
    if (withSignal) params.append("withSignal", "true");
    if (withGameIds) params.append("withGameIds", "true");
    if (withGameMetas) params.append("withGameMetas", "true");
    return client.json(`/users/status?${params.toString()}`);
  },
});

const getAllTop10 = tool({
  name: "get_all_top_10",
  description: "Get the top 10 players for each speed and variant",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/player"),
});

const getLeaderboard = tool({
  name: "get_leaderboard",
  description: "Get the leaderboard for a specific perf type",
  schema: z.object({
    perfType: z.enum(PERF_TYPES).describe("Performance type"),
    nb: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(100)
      .describe("Number of players to fetch (1-200)"),
  }),
  handler: async ({ perfType, nb }, { client }) =>
    client.json(`/player/top/${nb}/${perfType}`),
});

const getUserPublicData = tool({
  name: "get_user_public_data",
  description: "Get public data of a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
    withTrophies: z.boolean().optional().describe("Include trophy data"),
  }),
  handler: async ({ username, withTrophies }, { client }) => {
    const qs = withTrophies ? "?trophies=true" : "";
    return client.json(`/user/${encodeURIComponent(username)}${qs}`);
  },
});

const getRatingHistory = tool({
  name: "get_rating_history",
  description: "Get the rating history of a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
  }),
  handler: async ({ username }, { client }) =>
    client.json(`/user/${encodeURIComponent(username)}/rating-history`),
});

const getUserPerformance = tool({
  name: "get_user_performance",
  description: "Get user's performance statistics for a specific variant",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
    perf: z.enum(PERF_TYPES).describe("Performance type"),
  }),
  handler: async ({ username, perf }, { client }) =>
    client.json(`/user/${encodeURIComponent(username)}/perf/${perf}`),
});

const getUserActivity = tool({
  name: "get_user_activity",
  description: "Get the activity feed of a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
  }),
  handler: async ({ username }, { client }) =>
    client.json(`/user/${encodeURIComponent(username)}/activity`),
});

const getUsersById = tool({
  name: "get_users_by_id",
  description: "Get user data for a list of user IDs (POST body)",
  schema: z.object({
    ids: z
      .string()
      .trim()
      .min(1)
      .describe("Comma-separated user IDs (max 300)")
      .refine((s) => s.split(",").length <= 300, "Maximum of 300 user IDs allowed"),
  }),
  handler: async ({ ids }, { client }) => {
    const response = await client.postText("/users", ids, "text/plain");
    return (await response.json()) as object;
  },
});

const getLiveStreamers = tool({
  name: "get_live_streamers",
  description: "Get users who are streaming on Twitch or YouTube currently",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/streamer/live", { auth: false }),
});

const getCrosstable = tool({
  name: "get_crosstable",
  description: "Get head-to-head statistics between two users",
  schema: z.object({
    user1: z.string().trim().min(1).describe("First player username"),
    user2: z.string().trim().min(1).describe("Second player username"),
    matchup: z.boolean().optional().describe("Also send the current matchup games"),
  }),
  handler: async ({ user1, user2, matchup }, { client }) => {
    const qs = matchup ? "?matchup=true" : "";
    return client.json(
      `/crosstable/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}${qs}`,
    );
  },
});

const autocompletePlayer = tool({
  name: "autocomplete_player",
  description: "Autocomplete player username search",
  schema: z.object({
    term: z.string().trim().min(1).describe("Partial username to search"),
    object: z
      .boolean()
      .optional()
      .describe("Return User objects instead of just usernames"),
    friend: z
      .boolean()
      .optional()
      .describe("Show followed players first"),
  }),
  handler: async ({ term, object, friend }, { client }) => {
    const params = new URLSearchParams({ term });
    if (object) params.set("object", "true");
    if (friend) params.set("friend", "true");
    return client.json(`/player/autocomplete?${params.toString()}`);
  },
});

const readUserNote = tool({
  name: "read_user_note",
  description: "Read private notes about a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username to read notes about"),
  }),
  handler: async ({ username }, { client }) =>
    client.json(`/user/${encodeURIComponent(username)}/note`),
});

export const usersTools: AnyToolDefinition[] = [
  getUsersStatus,
  getAllTop10,
  getLeaderboard,
  getUserPublicData,
  getRatingHistory,
  getUserPerformance,
  getUserActivity,
  getUsersById,
  getLiveStreamers,
  getCrosstable,
  autocompletePlayer,
  readUserNote,
];
