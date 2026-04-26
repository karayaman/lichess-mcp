import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const engineIdSchema = z.object({
  id: z.string().trim().min(1).describe("The external engine ID"),
});

const engineBodySchema = {
  name: z.string().trim().min(3).max(200).describe("Display name of the engine"),
  maxThreads: z.number().int().min(1).max(65536).describe("Maximum number of available threads"),
  maxHash: z.number().int().min(1).max(1048576).describe("Maximum hash table size in MiB"),
  variants: z.array(z.string()).optional().describe("Supported chess variants"),
  providerSecret: z
    .string()
    .min(16)
    .max(1024)
    .describe("Secret token for the engine provider"),
  providerData: z.string().optional().describe("Arbitrary provider data"),
};

const listExternalEngines = tool({
  name: "list_external_engines",
  description: "List all external engines registered for the current user",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/external-engine"),
});

const createExternalEngine = tool({
  name: "create_external_engine",
  description: "Register a new external analysis engine",
  schema: z.object(engineBodySchema),
  handler: async (body, { client }) => {
    const response = await client.postJson("/external-engine", body);
    return (await response.json()) as object;
  },
});

const getExternalEngine = tool({
  name: "get_external_engine",
  description: "Get a specific external engine by ID",
  schema: engineIdSchema,
  handler: async ({ id }, { client }) =>
    client.json(`/external-engine/${encodeURIComponent(id)}`),
});

const updateExternalEngine = tool({
  name: "update_external_engine",
  description: "Update an external engine",
  schema: z.object({
    id: z.string().trim().min(1).describe("The external engine ID"),
    ...engineBodySchema,
  }),
  handler: async ({ id, ...body }, { client }) => {
    const response = await client.request(`/external-engine/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as object;
  },
});

const deleteExternalEngine = tool({
  name: "delete_external_engine",
  description: "Delete an external engine",
  schema: engineIdSchema,
  handler: async ({ id }, { client }) => {
    await client.delete(`/external-engine/${encodeURIComponent(id)}`);
    return `External engine ${id} deleted`;
  },
});

const analyseWithExternalEngine = tool({
  name: "analyse_with_external_engine",
  description: "Request analysis from an external engine",
  schema: z.object({
    id: z.string().trim().min(1).describe("The external engine ID"),
    work: z.object({
      sessionId: z.string().describe("Unique session ID"),
      threads: z.number().int().min(1).describe("Number of threads to use"),
      hash: z.number().int().min(1).describe("Hash table size in MiB"),
      multiPv: z.number().int().min(1).max(5).optional().describe("Number of PVs"),
      variant: z.string().optional(),
      initialFen: z.string().describe("Initial position FEN"),
      moves: z.array(z.string()).describe("Moves played from initial position"),
    }),
  }),
  handler: async ({ id, work }, { client }) => {
    const response = await client.postJson(
      `/external-engine/${encodeURIComponent(id)}/analyse`,
      work,
    );
    return (await response.json()) as object;
  },
});

const acquireExternalEngineWork = tool({
  name: "acquire_external_engine_work",
  description: "Long-poll for analysis work from an engine provider",
  schema: z.object({
    providerSecret: z.string().min(16).describe("The engine provider secret"),
  }),
  handler: async ({ providerSecret }, { client }) => {
    const response = await client.postJson("/external-engine/work", { providerSecret });
    return (await response.json()) as object;
  },
});

const submitExternalEngineWork = tool({
  name: "submit_external_engine_work",
  description: "Submit analysis results for a work request",
  schema: z.object({
    id: z.string().trim().min(1).describe("The work request ID"),
    pgn: z.string().trim().min(1).describe("Analysis results in PGN/UCI format"),
  }),
  handler: async ({ id, pgn }, { client }) => {
    await client.postText(`/external-engine/work/${encodeURIComponent(id)}`, pgn, "text/plain");
    return `Work ${id} submitted`;
  },
});

export const engineTools: AnyToolDefinition[] = [
  listExternalEngines,
  createExternalEngine,
  getExternalEngine,
  updateExternalEngine,
  deleteExternalEngine,
  analyseWithExternalEngine,
  acquireExternalEngineWork,
  submitExternalEngineWork,
];
