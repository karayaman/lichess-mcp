import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const pairingIdSchema = z.object({
  id: z.string().trim().min(1).describe("The bulk pairing ID"),
});

const listBulkPairings = tool({
  name: "list_bulk_pairings",
  description: "Get all upcoming bulk pairings for the current user",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/bulk-pairing"),
});

const createBulkPairing = tool({
  name: "create_bulk_pairing",
  description: "Create a bulk pairing for multiple players",
  schema: z.object({
    players: z
      .string()
      .trim()
      .min(1)
      .describe(
        "OAuth tokens in 'white:black' pairs separated by commas. E.g. tok1:tok2,tok3:tok4",
      ),
    "clock.limit": z.number().int().min(0).max(10800).describe("Clock initial time in seconds"),
    "clock.increment": z.number().int().min(0).max(60).describe("Clock increment in seconds"),
    rated: z.boolean().optional().default(false),
    variant: z
      .enum([
        "standard", "chess960", "crazyhouse", "antichess", "atomic",
        "horde", "kingOfTheHill", "racingKings", "threeCheck",
      ])
      .optional()
      .default("standard"),
    pairAt: z
      .number()
      .int()
      .optional()
      .describe("Timestamp (ms) when games will be created. Omit to start immediately."),
    startClocksAt: z
      .number()
      .int()
      .optional()
      .describe("Timestamp (ms) when clocks will start automatically."),
    message: z.string().optional().describe("Message sent to each player when game is created"),
    rules: z.string().optional().describe("Comma-separated special rules (noAbort, noRematch, etc.)"),
  }),
  handler: async (fields, { client }) => {
    const response = await client.postForm("/bulk-pairing", fields);
    return (await response.json()) as object;
  },
});

const startBulkPairingClocks = tool({
  name: "start_bulk_pairing_clocks",
  description: "Start the clocks of the games in a bulk pairing immediately",
  schema: pairingIdSchema,
  handler: async ({ id }, { client }) => {
    await client.post(`/bulk-pairing/${encodeURIComponent(id)}/start-clocks`);
    return `Clocks started for bulk pairing ${id}`;
  },
});

const getBulkPairing = tool({
  name: "get_bulk_pairing",
  description: "Get a bulk pairing by ID",
  schema: pairingIdSchema,
  handler: async ({ id }, { client }) =>
    client.json(`/bulk-pairing/${encodeURIComponent(id)}`),
});

const deleteBulkPairing = tool({
  name: "delete_bulk_pairing",
  description: "Delete an upcoming bulk pairing",
  schema: pairingIdSchema,
  handler: async ({ id }, { client }) => {
    await client.delete(`/bulk-pairing/${encodeURIComponent(id)}`);
    return `Bulk pairing ${id} deleted`;
  },
});

const getBulkPairingGames = tool({
  name: "get_bulk_pairing_games",
  description: "Get the games of a bulk pairing",
  schema: pairingIdSchema,
  handler: async ({ id }, { client }) =>
    client.ndjson(`/bulk-pairing/${encodeURIComponent(id)}/games`),
});

export const bulkPairingsTools: AnyToolDefinition[] = [
  listBulkPairings,
  createBulkPairing,
  startBulkPairingClocks,
  getBulkPairing,
  deleteBulkPairing,
  getBulkPairingGames,
];
