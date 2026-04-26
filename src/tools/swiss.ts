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

const swissIdSchema = z.object({
  swissId: z.string().trim().min(1).describe("The Swiss tournament ID"),
});

const createSwiss = tool({
  name: "create_swiss",
  description: "Create a new Swiss tournament for a team",
  schema: z.object({
    name: z.string().trim().min(1).describe("Tournament name"),
    teamId: z.string().trim().min(1).describe("ID of the hosting team"),
    clock: z.object({
      limit: z.number().min(0).describe("Clock time in seconds"),
      increment: z.number().min(0).describe("Clock increment in seconds"),
    }),
    nbRounds: z.number().int().min(1).default(7).describe("Number of rounds"),
    variant: z.enum(VARIANTS).optional().default("standard"),
    rated: z.boolean().optional().default(true),
    roundInterval: z
      .number()
      .int()
      .min(1)
      .default(300)
      .describe("Seconds between rounds"),
    description: z.string().optional(),
  }),
  handler: async ({ teamId, clock, ...rest }, { client }) => {
    const fields: Record<string, string | number | boolean | undefined> = {
      ...rest,
      "clock.limit": clock.limit,
      "clock.increment": clock.increment,
    };
    const response = await client.postForm(
      `/swiss/new/${encodeURIComponent(teamId)}`,
      fields,
    );
    return (await response.json()) as object;
  },
});

const getSwissInfo = tool({
  name: "get_swiss_info",
  description: "Get info about a Swiss tournament",
  schema: swissIdSchema,
  handler: async ({ swissId }, { client }) =>
    client.json(`/swiss/${encodeURIComponent(swissId)}`),
});

const getSwissGames = tool({
  name: "get_swiss_games",
  description: "Export games of a Swiss tournament",
  schema: z.object({
    swissId: z.string().trim().min(1),
    player: z.string().optional().describe("Filter by player username"),
    moves: z.boolean().optional(),
    pgnInJson: z.boolean().optional(),
    tags: z.boolean().optional(),
    clocks: z.boolean().optional(),
    evals: z.boolean().optional(),
    opening: z.boolean().optional(),
  }),
  handler: async ({ swissId, player, ...flags }, { client }) => {
    const params = new URLSearchParams();
    if (player) params.set("player", player);
    for (const [key, value] of Object.entries(flags)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.ndjson(`/swiss/${encodeURIComponent(swissId)}/games${qs}`);
  },
});

const getSwissResults = tool({
  name: "get_swiss_results",
  description: "Get results of a Swiss tournament",
  schema: z.object({
    swissId: z.string().trim().min(1),
    nb: z.number().int().min(1).optional().describe("Number of results to fetch"),
  }),
  handler: async ({ swissId, nb }, { client }) => {
    const qs = nb !== undefined ? `?nb=${nb}` : "";
    return client.ndjson(`/swiss/${encodeURIComponent(swissId)}/results${qs}`);
  },
});

const joinSwiss = tool({
  name: "join_swiss",
  description: "Join a Swiss tournament",
  schema: swissIdSchema,
  handler: async ({ swissId }, { client }) => {
    await client.post(`/swiss/${encodeURIComponent(swissId)}/join`);
    return `Successfully joined Swiss tournament ${swissId}`;
  },
});

const withdrawFromSwiss = tool({
  name: "withdraw_from_swiss",
  description: "Withdraw from a Swiss tournament",
  schema: swissIdSchema,
  handler: async ({ swissId }, { client }) => {
    await client.post(`/swiss/${encodeURIComponent(swissId)}/withdraw`);
    return `Successfully withdrew from Swiss tournament ${swissId}`;
  },
});

const updateSwiss = tool({
  name: "update_swiss",
  description: "Update a Swiss tournament",
  schema: z.object({
    swissId: z.string().trim().min(1).describe("The Swiss tournament ID"),
    name: z.string().optional(),
    nbRounds: z.number().int().min(1).optional(),
    rated: z.boolean().optional(),
    description: z.string().optional(),
  }),
  handler: async ({ swissId, ...fields }, { client }) => {
    const response = await client.postForm(
      `/swiss/${encodeURIComponent(swissId)}/edit`,
      fields,
    );
    return (await response.json()) as object;
  },
});

const scheduleNextSwissRound = tool({
  name: "schedule_next_swiss_round",
  description: "Manually schedule the next round of a Swiss tournament",
  schema: z.object({
    swissId: z.string().trim().min(1).describe("The Swiss tournament ID"),
    date: z.number().int().describe("Timestamp (milliseconds) for when to start the next round"),
  }),
  handler: async ({ swissId, date }, { client }) => {
    await client.postForm(`/swiss/${encodeURIComponent(swissId)}/schedule-next-round`, {
      date,
    });
    return `Next round of Swiss tournament ${swissId} scheduled`;
  },
});

const terminateSwiss = tool({
  name: "terminate_swiss",
  description: "Terminate a Swiss tournament",
  schema: swissIdSchema,
  handler: async ({ swissId }, { client }) => {
    await client.post(`/swiss/${encodeURIComponent(swissId)}/terminate`);
    return `Swiss tournament ${swissId} terminated`;
  },
});

const getSwissTrf = tool({
  name: "get_swiss_trf",
  description: "Download the TRF file for a Swiss tournament (FIDE format)",
  schema: swissIdSchema,
  handler: async ({ swissId }, { client }) => {
    const response = await client.request(
      `/swiss/${encodeURIComponent(swissId)}.trf`,
      { baseUrl: "https://lichess.org" },
    );
    return response.text();
  },
});

export const swissTools: AnyToolDefinition[] = [
  createSwiss,
  getSwissInfo,
  getSwissGames,
  getSwissResults,
  joinSwiss,
  withdrawFromSwiss,
  updateSwiss,
  scheduleNextSwissRound,
  terminateSwiss,
  getSwissTrf,
];
