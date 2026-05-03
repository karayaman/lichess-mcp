import { z } from "zod";
import { tool } from "../../registry.js";

/**
 * POST /api/puzzle/batch/{angle} — "Set puzzles as solved and update ratings."
 *
 * Called by the puzzle iframe after the user finishes a rated session. The
 * iframe receives back per-puzzle ratingDiff values plus the new glicko rating
 * and renders them as a results panel. There is no UI resource of its own.
 */
export const submitPuzzleBatch = tool({
  name: "submit_puzzle_batch",
  description:
    "Internal callback for the play_puzzle iframe to submit a completed rated batch and update the user's puzzle rating. Not exposed to the model — see solve_puzzle_batch for the model-callable equivalent. Requires the puzzle:write OAuth scope.",
  ui: { visibility: ["app"] },
  schema: z.object({
    angle: z
      .string()
      .trim()
      .min(1)
      .describe("The theme/angle the batch was drawn from."),
    solutions: z
      .array(
        z.object({
          id: z.string().describe("Puzzle id."),
          win: z.boolean().describe("Whether the puzzle was solved without errors."),
          rated: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether this attempt should affect rating (default true)."),
        }),
      )
      .min(1)
      .describe("Per-puzzle results."),
  }),
  handler: async ({ angle, solutions }, { client }) => {
    const body = {
      solutions: solutions.map((s) => ({
        id: s.id,
        win: s.win,
        rated: s.rated ?? true,
      })),
    };
    const response = await client.postJson(
      `/puzzle/batch/${encodeURIComponent(angle)}`,
      body,
    );
    return (await response.json()) as object;
  },
});
