import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const getDailyPuzzle = tool({
  name: "get_daily_puzzle",
  description: "Get the daily puzzle",
  schema: z.object({}),
  handler: async (_args, { client }) => client.json("/puzzle/daily"),
});

const getPuzzleById = tool({
  name: "get_puzzle_by_id",
  description: "Get a puzzle by its ID",
  schema: z.object({
    id: z.string().trim().min(1).describe("The puzzle ID"),
  }),
  handler: async ({ id }, { client }) =>
    client.json(`/puzzle/${encodeURIComponent(id)}`),
});

const getNextPuzzle = tool({
  name: "get_next_puzzle",
  description: "Get the next puzzle for the authenticated user",
  schema: z.object({
    angle: z.string().optional().describe("Puzzle theme/angle"),
    difficulty: z.string().optional().describe("Difficulty level"),
    color: z.enum(["white", "black"]).optional().describe("Color to play"),
  }),
  handler: async ({ angle, difficulty, color }, { client }) => {
    const params = new URLSearchParams();
    if (angle) params.set("angle", angle);
    if (difficulty) params.set("difficulty", difficulty);
    if (color) params.set("color", color);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.json(`/puzzle/next${qs}`);
  },
});

const getPuzzleBatch = tool({
  name: "get_puzzle_batch",
  description: "Get a batch of puzzles for offline solving",
  schema: z.object({
    angle: z.string().trim().min(1).describe("Puzzle theme/angle (use 'mix' for mixed)"),
    nb: z.number().int().min(1).max(500).optional().describe("Number of puzzles (max 500)"),
    difficulty: z.string().optional().describe("Difficulty level"),
    color: z.enum(["white", "black"]).optional().describe("Color to play"),
  }),
  handler: async ({ angle, nb, difficulty, color }, { client }) => {
    const params = new URLSearchParams();
    if (nb !== undefined) params.set("nb", String(nb));
    if (difficulty) params.set("difficulty", difficulty);
    if (color) params.set("color", color);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.json(`/puzzle/batch/${encodeURIComponent(angle)}${qs}`);
  },
});

const solvePuzzleBatch = tool({
  name: "solve_puzzle_batch",
  description:
    "Submit solved puzzles from a batch back to Lichess. With `rated: true` (default) the result affects the user's puzzle rating. The response contains rounds[] with per-puzzle ratingDiff and the new glicko rating.",
  schema: z.object({
    angle: z.string().trim().min(1).describe("Puzzle theme/angle"),
    solutions: z
      .array(
        z.object({
          id: z.string().describe("Puzzle ID"),
          win: z.boolean().describe("Whether the puzzle was solved without errors"),
          rated: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether this attempt should affect the user's rating"),
        }),
      )
      .describe("Array of puzzle solutions"),
    nb: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe("If > 0, response also includes a fresh batch of N puzzles"),
  }),
  handler: async ({ angle, solutions, nb }, { client }) => {
    const qs = nb !== undefined ? `?nb=${nb}` : "";
    const body = {
      solutions: solutions.map((s) => ({
        id: s.id,
        win: s.win,
        rated: s.rated ?? true,
      })),
    };
    const response = await client.postJson(
      `/puzzle/batch/${encodeURIComponent(angle)}${qs}`,
      body,
    );
    return (await response.json()) as object;
  },
});

const replayPuzzles = tool({
  name: "replay_puzzles",
  description: "Replay puzzles by theme and number of days",
  schema: z.object({
    days: z.number().int().min(1).describe("Number of days to look back"),
    theme: z.string().trim().min(1).describe("Puzzle theme to replay"),
  }),
  handler: async ({ days, theme }, { client }) =>
    client.json(`/puzzle/replay/${days}/${encodeURIComponent(theme)}`),
});

const getPuzzleActivity = tool({
  name: "get_puzzle_activity",
  description: "Get your puzzle activity",
  schema: z.object({
    max: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("How many entries to download. Leave empty to get all activity."),
  }),
  handler: async ({ max }, { client }) => {
    const qs = max !== undefined ? `?max=${max}` : "";
    return client.json(`/puzzle/activity${qs}`);
  },
});

const getPuzzleDashboard = tool({
  name: "get_puzzle_dashboard",
  description: "Get your puzzle dashboard",
  schema: z.object({
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(30)
      .describe("How many days of history to return (max 30)"),
  }),
  handler: async ({ days }, { client }) => client.json(`/puzzle/dashboard/${days}`),
});

const getPuzzleRace = tool({
  name: "get_puzzle_race",
  description: "Get info about a puzzle race",
  schema: z.object({
    raceId: z.string().trim().min(1).describe("ID of the puzzle race"),
  }),
  handler: async ({ raceId }, { client }) =>
    client.json(`/racer/${encodeURIComponent(raceId)}`),
});

const createPuzzleRace = tool({
  name: "create_puzzle_race",
  description: "Create a new puzzle race",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    const response = await client.post("/racer");
    return (await response.json()) as object;
  },
});

const getPuzzleStormDashboard = tool({
  name: "get_puzzle_storm_dashboard",
  description: "Get puzzle storm dashboard for a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username to get storm dashboard for"),
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(30)
      .describe("How many days of history to return (max 30)"),
  }),
  handler: async ({ username, days }, { client }) =>
    client.json(`/storm/dashboard/${encodeURIComponent(username)}?days=${days}`),
});

export const puzzlesTools: AnyToolDefinition[] = [
  getDailyPuzzle,
  getPuzzleById,
  getNextPuzzle,
  getPuzzleBatch,
  solvePuzzleBatch,
  replayPuzzles,
  getPuzzleActivity,
  getPuzzleDashboard,
  getPuzzleRace,
  createPuzzleRace,
  getPuzzleStormDashboard,
];
