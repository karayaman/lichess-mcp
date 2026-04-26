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

const simulIdSchema = z.object({
  simulId: z.string().trim().min(1).describe("The simul ID"),
});

const getCurrentSimuls = tool({
  name: "get_current_simuls",
  description: "Get current simuls",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/simul"),
});

const createSimul = tool({
  name: "create_simul",
  description: "Create a new simul",
  schema: z.object({
    name: z.string().trim().min(1).describe("Name of the simul"),
    variant: z.enum(VARIANTS).optional().default("standard"),
    clockTime: z.number().min(0).default(5).describe("Clock time in minutes"),
    clockIncrement: z.number().min(0).default(3).describe("Clock increment in seconds"),
    color: z.enum(["white", "black"]).optional().default("white"),
    minRating: z.number().optional().describe("Minimum rating for opponents"),
    maxRating: z.number().optional().describe("Maximum rating for opponents"),
    text: z.string().optional().describe("Description text"),
  }),
  handler: async (args, { client }) => {
    const response = await client.postJson("/simul/new", args);
    return (await response.json()) as object;
  },
});

const joinSimul = tool({
  name: "join_simul",
  description: "Join a simul",
  schema: simulIdSchema,
  handler: async ({ simulId }, { client }) => {
    await client.post(`/simul/${encodeURIComponent(simulId)}/join`);
    return `Successfully joined simul ${simulId}`;
  },
});

const withdrawFromSimul = tool({
  name: "withdraw_from_simul",
  description: "Withdraw from a simul",
  schema: simulIdSchema,
  handler: async ({ simulId }, { client }) => {
    await client.post(`/simul/${encodeURIComponent(simulId)}/withdraw`);
    return `Successfully withdrew from simul ${simulId}`;
  },
});

export const simulTools: AnyToolDefinition[] = [
  getCurrentSimuls,
  createSimul,
  joinSimul,
  withdrawFromSimul,
];
