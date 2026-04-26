import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const TABLEBASE_BASE = "https://tablebase.lichess.org";

const fenSchema = z.object({
  fen: z.string().trim().min(1).describe("FEN of the position to look up"),
});

const lookupStandardTablebase = tool({
  name: "lookup_standard_tablebase",
  description: "Look up a position in the Syzygy tablebase (standard chess)",
  schema: z.object({
    fen: z.string().trim().min(1).describe("FEN of the position"),
    dtc: z.boolean().optional().describe("Include distance to conversion (DTC) metric"),
  }),
  handler: async ({ fen, dtc }, { client }) => {
    const params = new URLSearchParams({ fen });
    if (dtc !== undefined) params.set("dtc", String(dtc));
    return client.json(`/standard?${params.toString()}`, {
      baseUrl: TABLEBASE_BASE,
      auth: false,
    });
  },
});

const lookupAtomicTablebase = tool({
  name: "lookup_atomic_tablebase",
  description: "Look up a position in the Syzygy tablebase (atomic chess variant)",
  schema: fenSchema,
  handler: async ({ fen }, { client }) => {
    const params = new URLSearchParams({ fen });
    return client.json(`/atomic?${params.toString()}`, {
      baseUrl: TABLEBASE_BASE,
      auth: false,
    });
  },
});

const lookupAntichessTablebase = tool({
  name: "lookup_antichess_tablebase",
  description: "Look up a position in the Syzygy tablebase (antichess variant)",
  schema: fenSchema,
  handler: async ({ fen }, { client }) => {
    const params = new URLSearchParams({ fen });
    return client.json(`/antichess?${params.toString()}`, {
      baseUrl: TABLEBASE_BASE,
      auth: false,
    });
  },
});

export const tablebaseTools: AnyToolDefinition[] = [
  lookupStandardTablebase,
  lookupAtomicTablebase,
  lookupAntichessTablebase,
];
