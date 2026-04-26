import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const setToken = tool({
  name: "set_token",
  description: "Set your Lichess API token",
  schema: z.object({
    token: z.string().min(1).describe("Your Lichess API token"),
  }),
  handler: async ({ token }, { tokens }) => {
    tokens.set(token);
    return "Lichess API token has been set";
  },
});

const getMyProfile = tool({
  name: "get_my_profile",
  description: "Get your Lichess profile information",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/account"),
});

const getUserProfile = tool({
  name: "get_user_profile",
  description: "Get a user's Lichess profile information",
  schema: z.object({
    username: z.string().min(1).describe("Username of the player"),
    trophies: z.boolean().default(false).describe("Include user trophies"),
  }),
  handler: async ({ username, trophies }, { client }) =>
    client.json(`/user/${encodeURIComponent(username)}${trophies ? "?trophies=true" : ""}`),
});

const getMyEmail = tool({
  name: "get_my_email",
  description: "Get your email address",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    const data = await client.json<{ email: string }>("/account/email");
    return `Your email address is: ${data.email}`;
  },
});

const getKidMode = tool({
  name: "get_kid_mode",
  description: "Get kid mode status",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    const data = await client.json<{ kid: boolean }>("/account/kid");
    return `Kid mode is ${data.kid ? "enabled" : "disabled"}`;
  },
});

const setKidMode = tool({
  name: "set_kid_mode",
  description: "Set kid mode status",
  schema: z.object({
    value: z.boolean().describe("Enable or disable kid mode"),
  }),
  handler: async ({ value }, { client }) => {
    await client.post(`/account/kid?v=${value}`);
    return `Kid mode has been ${value ? "enabled" : "disabled"}`;
  },
});

const getPreferences = tool({
  name: "get_preferences",
  description: "Get your preferences",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/account/preferences"),
});

const getTimeline = tool({
  name: "get_timeline",
  description: "Get your timeline",
  schema: z.object({
    since: z.number().int().optional().describe("Show events since this timestamp"),
    nb: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(15)
      .describe("Max number of events to fetch (1-30)"),
  }),
  handler: async ({ since, nb }, { client }) => {
    const params = new URLSearchParams();
    if (since !== undefined) params.set("since", String(since));
    params.set("nb", String(nb));
    return client.json(`/timeline?${params.toString()}`);
  },
});

const testTokens = tool({
  name: "test_tokens",
  description: "Test multiple OAuth tokens",
  schema: z.object({
    tokens: z
      .string()
      .min(1)
      .describe("OAuth tokens separated by commas. Up to 1000."),
  }),
  handler: async ({ tokens }, { client }) => {
    if (tokens.split(",").length > 1000) {
      throw new Error("Maximum of 1000 tokens allowed");
    }
    const response = await client.postText("/token/test", tokens, "text/plain", { auth: false });
    return (await response.json()) as object;
  },
});

const revokeToken = tool({
  name: "revoke_token",
  description: "Revoke the current access token",
  schema: z.object({}),
  handler: async (_args, { client, tokens }) => {
    if (!tokens.get()) {
      throw new Error("No token set to revoke. Please set a token first using set_token.");
    }
    await client.delete("/token");
    tokens.clear();
    return "Access token has been successfully revoked and cleared";
  },
});

const upgradeToBot = tool({
  name: "upgrade_to_bot",
  description: "Upgrade your account to a Bot account",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    await client.post("/bot/account/upgrade");
    return "Account has been successfully upgraded to a Bot account. The account can now only play as a Bot.";
  },
});

const addUserNote = tool({
  name: "add_user_note",
  description: "Add a private note about a user",
  schema: z.object({
    username: z.string().min(1).describe("Username to add a note about"),
    text: z.string().min(1).describe("Note text"),
  }),
  handler: async ({ username, text }, { client }) => {
    await client.postForm(`/user/${encodeURIComponent(username)}/note`, { text });
    return `Note successfully added for user ${username}`;
  },
});

export const accountTools: AnyToolDefinition[] = [
  setToken,
  getMyProfile,
  getUserProfile,
  getMyEmail,
  getKidMode,
  setKidMode,
  getPreferences,
  getTimeline,
  testTokens,
  revokeToken,
  upgradeToBot,
  addUserNote,
];
