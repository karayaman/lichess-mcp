import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const VARIANTS = [
  "standard",
  "chess960",
  "crazyhouse",
  "antichess",
  "atomic",
  "horde",
  "kingOfTheHill",
  "racingKings",
  "threeCheck",
] as const;

const DECLINE_REASONS = [
  "generic",
  "later",
  "tooFast",
  "tooSlow",
  "timeControl",
  "rated",
  "casual",
  "standard",
  "variant",
  "noBot",
  "onlyBot",
] as const;

const createChallenge = tool({
  name: "create_challenge",
  description: "Challenge another player to a game",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player to challenge"),
    rated: z.boolean().optional().describe("Whether the game is rated"),
    clock: z
      .object({
        limit: z.number().min(0).describe("Clock initial time in minutes"),
        increment: z.number().min(0).describe("Clock increment in seconds"),
      })
      .optional()
      .describe("Clock settings"),
    days: z.number().int().min(1).optional().describe("Days per turn for correspondence games"),
    color: z.enum(["random", "white", "black"]).optional().describe("Color to play"),
    variant: z.enum(VARIANTS).optional().default("standard").describe("Game variant"),
    fen: z.string().optional().describe("Custom initial position in FEN format"),
  }),
  handler: async ({ username, clock, ...rest }, { client }) => {
    const fields: Record<string, string | number | boolean | undefined> = { ...rest };
    if (clock) {
      fields["clock.limit"] = clock.limit * 60; // convert minutes → seconds
      fields["clock.increment"] = clock.increment;
    }
    const response = await client.postForm(
      `/challenge/${encodeURIComponent(username)}`,
      fields,
    );
    const data = (await response.json()) as { challenge: { url: string } };
    return `Challenge created: ${data.challenge.url}`;
  },
});

const listChallenges = tool({
  name: "list_challenges",
  description: "List incoming and outgoing challenges",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/challenge"),
});

const acceptChallenge = tool({
  name: "accept_challenge",
  description: "Accept an incoming challenge",
  schema: z.object({
    challengeId: z.string().trim().min(1).describe("ID of the challenge to accept"),
  }),
  handler: async ({ challengeId }, { client }) => {
    await client.post(`/challenge/${encodeURIComponent(challengeId)}/accept`);
    return `Challenge ${challengeId} accepted`;
  },
});

const declineChallenge = tool({
  name: "decline_challenge",
  description: "Decline an incoming challenge",
  schema: z.object({
    challengeId: z.string().trim().min(1).describe("ID of the challenge to decline"),
    reason: z.enum(DECLINE_REASONS).optional().default("generic").describe("Reason for declining"),
  }),
  handler: async ({ challengeId, reason }, { client }) => {
    await client.postJson(`/challenge/${encodeURIComponent(challengeId)}/decline`, { reason });
    return `Challenge ${challengeId} declined`;
  },
});

const cancelChallenge = tool({
  name: "cancel_challenge",
  description: "Cancel an outgoing challenge",
  schema: z.object({
    challengeId: z.string().trim().min(1).describe("ID of the challenge to cancel"),
  }),
  handler: async ({ challengeId }, { client }) => {
    await client.post(`/challenge/${encodeURIComponent(challengeId)}/cancel`);
    return `Challenge ${challengeId} cancelled`;
  },
});

const getChallenge = tool({
  name: "get_challenge",
  description: "Get details about a specific challenge",
  schema: z.object({
    challengeId: z.string().trim().min(1).describe("ID of the challenge"),
  }),
  handler: async ({ challengeId }, { client }) =>
    client.json(`/challenge/${encodeURIComponent(challengeId)}/show`),
});

const challengeAi = tool({
  name: "challenge_ai",
  description: "Start a game with the Lichess AI (Stockfish)",
  schema: z.object({
    level: z.number().int().min(1).max(8).describe("AI strength (1-8)"),
    clock: z
      .object({
        limit: z.number().int().min(0).describe("Clock initial time in seconds"),
        increment: z.number().int().min(0).describe("Clock increment in seconds"),
      })
      .optional(),
    days: z.number().int().optional().describe("Days per move for correspondence"),
    color: z.enum(["random", "white", "black"]).optional().default("random"),
    variant: z.enum(VARIANTS).optional().default("standard"),
    fen: z.string().optional().describe("Custom initial position in FEN"),
  }),
  handler: async ({ clock, ...rest }, { client }) => {
    const fields: Record<string, string | number | boolean | undefined> = { ...rest };
    if (clock) {
      fields["clock.limit"] = clock.limit;
      fields["clock.increment"] = clock.increment;
    }
    const response = await client.postForm("/challenge/ai", fields);
    return (await response.json()) as object;
  },
});

const createOpenChallenge = tool({
  name: "create_open_challenge",
  description: "Create an open challenge that anyone can accept",
  schema: z.object({
    rated: z.boolean().optional().default(false),
    clock: z
      .object({
        limit: z.number().int().min(0).describe("Clock initial time in seconds"),
        increment: z.number().int().min(0).describe("Clock increment in seconds"),
      })
      .optional(),
    days: z.number().int().optional().describe("Days per turn for correspondence"),
    variant: z.enum(VARIANTS).optional().default("standard"),
    fen: z.string().optional().describe("Custom initial position in FEN"),
  }),
  handler: async ({ clock, ...rest }, { client }) => {
    const fields: Record<string, string | number | boolean | undefined> = { ...rest };
    if (clock) {
      fields["clock.limit"] = clock.limit;
      fields["clock.increment"] = clock.increment;
    }
    const response = await client.postForm("/challenge/open", fields);
    return (await response.json()) as object;
  },
});

const startChallengeClocks = tool({
  name: "start_challenge_clocks",
  description: "Start the clocks of a game immediately (both players must have provided tokens)",
  schema: z.object({
    gameId: z.string().trim().min(1).describe("The game ID"),
    token1: z.string().trim().min(1).describe("OAuth token of player 1"),
    token2: z.string().trim().min(1).describe("OAuth token of player 2"),
  }),
  handler: async ({ gameId, token1, token2 }, { client }) => {
    const params = new URLSearchParams({ token1, token2 });
    await client.post(`/challenge/${encodeURIComponent(gameId)}/start-clocks?${params.toString()}`);
    return `Clocks started for game ${gameId}`;
  },
});

const addTimeToGame = tool({
  name: "add_time_to_game",
  description: "Add seconds to the clock of the opponent",
  schema: z.object({
    gameId: z.string().trim().min(1).describe("The game ID"),
    seconds: z.number().int().min(1).describe("Number of seconds to add"),
  }),
  handler: async ({ gameId, seconds }, { client }) => {
    await client.post(
      `/round/${encodeURIComponent(gameId)}/add-time/${seconds}`,
    );
    return `Added ${seconds} seconds to game ${gameId}`;
  },
});

const adminChallengeTokens = tool({
  name: "admin_challenge_tokens",
  description: "Create tokens for admin-generated challenges (requires admin:challenge scope)",
  schema: z.object({
    users: z.string().trim().min(1).describe("Comma-separated list of usernames"),
    description: z.string().trim().min(1).describe("Description of the token purpose"),
  }),
  handler: async ({ users, description }, { client }) => {
    const response = await client.postForm("/token/admin-challenge", {
      users,
      description,
    });
    return (await response.json()) as object;
  },
});

export const challengesTools: AnyToolDefinition[] = [
  createChallenge,
  listChallenges,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  getChallenge,
  challengeAi,
  createOpenChallenge,
  startChallengeClocks,
  addTimeToGame,
  adminChallengeTokens,
];
