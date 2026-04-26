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

const tournamentIdSchema = z.object({
  tournamentId: z.string().trim().min(1).describe("The tournament ID"),
});

const getArenaTournaments = tool({
  name: "get_arena_tournaments",
  description: "Get current arena tournaments",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/tournament"),
});

const createArena = tool({
  name: "create_arena",
  description: "Create a new arena tournament",
  schema: z.object({
    name: z.string().trim().min(1).describe("Name of the tournament"),
    clockTime: z.number().min(0).default(3).describe("Clock initial time in minutes"),
    clockIncrement: z.number().min(0).default(2).describe("Clock increment in seconds"),
    minutes: z.number().int().min(1).default(45).describe("Tournament duration in minutes"),
    waitMinutes: z.number().int().min(1).default(5).describe("Time before tournament starts (minutes)"),
    startDate: z.number().int().optional().describe("Timestamp to start the tournament"),
    variant: z.enum(VARIANTS).optional().default("standard"),
    rated: z.boolean().optional().default(true),
    position: z.string().optional().describe("Custom initial position in FEN"),
    berserkable: z.boolean().optional().default(true),
    streakable: z.boolean().optional().default(true),
    hasChat: z.boolean().optional().default(true),
    description: z.string().optional().describe("Tournament description (HTML)"),
    conditions: z
      .object({
        nbRatedGame: z.number().optional(),
        minRating: z.number().optional(),
        maxRating: z.number().optional(),
        teamMember: z.string().optional(),
      })
      .optional(),
  }),
  handler: async (args, { client }) => {
    const response = await client.postJson("/tournament", args);
    return (await response.json()) as object;
  },
});

const getArenaInfo = tool({
  name: "get_arena_info",
  description: "Get info about an arena tournament",
  schema: tournamentIdSchema,
  handler: async ({ tournamentId }, { client }) =>
    client.json(`/tournament/${encodeURIComponent(tournamentId)}`),
});

const getArenaGames = tool({
  name: "get_arena_games",
  description: "Export games of an arena tournament",
  schema: tournamentIdSchema,
  handler: async ({ tournamentId }, { client }) =>
    client.json(`/tournament/${encodeURIComponent(tournamentId)}/games`),
});

const getArenaResults = tool({
  name: "get_arena_results",
  description: "Get results of an arena tournament",
  schema: z.object({
    tournamentId: z.string().trim().min(1),
    nb: z.number().int().min(1).optional().describe("Number of results to fetch"),
    sheet: z.boolean().optional().describe("Include score sheets"),
  }),
  handler: async ({ tournamentId, nb, sheet }, { client }) => {
    const params = new URLSearchParams();
    if (nb !== undefined) params.set("nb", String(nb));
    if (sheet !== undefined) params.set("sheet", String(sheet));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.json(`/tournament/${encodeURIComponent(tournamentId)}/results${qs}`);
  },
});

const joinArena = tool({
  name: "join_arena",
  description: "Join an arena tournament",
  schema: tournamentIdSchema,
  handler: async ({ tournamentId }, { client }) => {
    await client.post(`/tournament/${encodeURIComponent(tournamentId)}/join`);
    return `Successfully joined tournament ${tournamentId}`;
  },
});

const withdrawFromArena = tool({
  name: "withdraw_from_arena",
  description: "Withdraw from an arena tournament",
  schema: tournamentIdSchema,
  handler: async ({ tournamentId }, { client }) => {
    await client.post(`/tournament/${encodeURIComponent(tournamentId)}/withdraw`);
    return `Successfully withdrew from tournament ${tournamentId}`;
  },
});

const getTeamBattleResults = tool({
  name: "get_team_battle_results",
  description: "Get team standings of a team battle tournament",
  schema: tournamentIdSchema,
  handler: async ({ tournamentId }, { client }) =>
    client.json(`/tournament/${encodeURIComponent(tournamentId)}/teams`),
});

const updateArena = tool({
  name: "update_arena",
  description: "Update an existing arena tournament",
  schema: z.object({
    tournamentId: z.string().trim().min(1).describe("The tournament ID"),
    name: z.string().optional(),
    clockTime: z.number().optional(),
    clockIncrement: z.number().int().optional(),
    minutes: z.number().int().optional(),
    variant: z.enum(VARIANTS).optional(),
    rated: z.boolean().optional(),
    description: z.string().optional(),
  }),
  handler: async ({ tournamentId, ...fields }, { client }) => {
    const response = await client.postForm(
      `/tournament/${encodeURIComponent(tournamentId)}`,
      fields,
    );
    return (await response.json()) as object;
  },
});

const terminateArena = tool({
  name: "terminate_arena",
  description: "Terminate an arena tournament",
  schema: z.object({
    tournamentId: z.string().trim().min(1).describe("The tournament ID"),
  }),
  handler: async ({ tournamentId }, { client }) => {
    await client.post(`/tournament/${encodeURIComponent(tournamentId)}/terminate`);
    return `Tournament ${tournamentId} terminated`;
  },
});

const updateTeamBattle = tool({
  name: "update_team_battle",
  description: "Set the teams and number of leaders for a team battle tournament",
  schema: z.object({
    tournamentId: z.string().trim().min(1).describe("The team battle tournament ID"),
    teams: z.string().trim().min(1).describe("Comma-separated list of team IDs"),
    nbLeaders: z.number().int().min(1).describe("Number of leaders per team"),
  }),
  handler: async ({ tournamentId, teams, nbLeaders }, { client }) => {
    const response = await client.postForm(
      `/tournament/team-battle/${encodeURIComponent(tournamentId)}`,
      { teams, nbLeaders },
    );
    return (await response.json()) as object;
  },
});

const getUserTournamentsCreated = tool({
  name: "get_user_tournaments_created",
  description: "Get tournaments created by a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the tournament creator"),
    nb: z.number().int().min(1).optional().describe("Number of tournaments to return"),
    status: z.number().int().optional().describe("Filter by status (10=created, 20=started, 30=finished)"),
  }),
  handler: async ({ username, nb, status }, { client }) => {
    const params = new URLSearchParams();
    if (nb !== undefined) params.set("nb", String(nb));
    if (status !== undefined) params.set("status", String(status));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.ndjson(`/user/${encodeURIComponent(username)}/tournament/created${qs}`);
  },
});

const getUserTournamentsPlayed = tool({
  name: "get_user_tournaments_played",
  description: "Get tournaments played by a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
    nb: z.number().int().min(1).optional().describe("Number of tournaments to return"),
    performance: z.boolean().optional().describe("Include performance rating"),
  }),
  handler: async ({ username, nb, performance }, { client }) => {
    const params = new URLSearchParams();
    if (nb !== undefined) params.set("nb", String(nb));
    if (performance !== undefined) params.set("performance", String(performance));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.ndjson(`/user/${encodeURIComponent(username)}/tournament/played${qs}`);
  },
});

export const arenaTools: AnyToolDefinition[] = [
  getArenaTournaments,
  createArena,
  getArenaInfo,
  getArenaGames,
  getArenaResults,
  joinArena,
  withdrawFromArena,
  getTeamBattleResults,
  updateArena,
  terminateArena,
  updateTeamBattle,
  getUserTournamentsCreated,
  getUserTournamentsPlayed,
];
