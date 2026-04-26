import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const usernameSchema = z.object({
  username: z.string().trim().min(1).describe("Username of the player"),
});

const getFollowing = tool({
  name: "get_following",
  description: "Get the list of users you follow (NDJSON stream)",
  schema: z.object({}),
  handler: async (_args, { client }) => client.ndjson("/rel/following"),
});

const followUser = tool({
  name: "follow_user",
  description: "Follow a player",
  schema: usernameSchema,
  handler: async ({ username }, { client }) => {
    await client.post(`/rel/follow/${encodeURIComponent(username)}`);
    return `Successfully following ${username}`;
  },
});

const unfollowUser = tool({
  name: "unfollow_user",
  description: "Unfollow a player",
  schema: usernameSchema,
  handler: async ({ username }, { client }) => {
    await client.post(`/rel/unfollow/${encodeURIComponent(username)}`);
    return `Successfully unfollowed ${username}`;
  },
});

const blockUser = tool({
  name: "block_user",
  description: "Block a player",
  schema: usernameSchema,
  handler: async ({ username }, { client }) => {
    await client.post(`/rel/block/${encodeURIComponent(username)}`);
    return `Successfully blocked ${username}`;
  },
});

const unblockUser = tool({
  name: "unblock_user",
  description: "Unblock a player",
  schema: usernameSchema,
  handler: async ({ username }, { client }) => {
    await client.post(`/rel/unblock/${encodeURIComponent(username)}`);
    return `Successfully unblocked ${username}`;
  },
});

export const relationsTools: AnyToolDefinition[] = [
  getFollowing,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
];
