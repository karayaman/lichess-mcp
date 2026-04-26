import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const gameIdSchema = z.string().trim().min(1).describe("The game ID");

const makeBoardMove = tool({
  name: "make_board_move",
  description: "Make a move in an ongoing board game",
  schema: z.object({
    gameId: gameIdSchema,
    move: z.string().trim().min(1).describe("Move in UCI format (e.g. e2e4)"),
    offeringDraw: z.boolean().optional().describe("Whether to offer/accept a draw"),
  }),
  handler: async ({ gameId, move, offeringDraw }, { client }) => {
    const qs = offeringDraw ? "?offeringDraw=true" : "";
    await client.post(`/board/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(move)}${qs}`);
    return `Move ${move} made in game ${gameId}${offeringDraw ? " with draw offer" : ""}`;
  },
});

const makeMove = tool({
  name: "make_move",
  description: "Make a move in an ongoing game",
  schema: z.object({
    gameId: gameIdSchema,
    move: z.string().trim().min(1).describe("Move in UCI format (e.g. e2e4)"),
    offeringDraw: z.boolean().optional().default(false).describe("Whether to offer/accept a draw"),
  }),
  handler: async ({ gameId, move, offeringDraw }, { client }) => {
    const qs = offeringDraw ? "?offeringDraw=true" : "";
    await client.post(`/board/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(move)}${qs}`);
    return `Move ${move} made in game ${gameId}${offeringDraw ? " with draw offer" : ""}`;
  },
});

const abortBoardGame = tool({
  name: "abort_board_game",
  description: "Abort a board game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/board/game/${encodeURIComponent(gameId)}/abort`);
    return `Game ${gameId} aborted`;
  },
});

const resignBoardGame = tool({
  name: "resign_board_game",
  description: "Resign a board game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/board/game/${encodeURIComponent(gameId)}/resign`);
    return `Resigned game ${gameId}`;
  },
});

const writeInChat = tool({
  name: "write_in_chat",
  description: "Write in the chat of a board game",
  schema: z.object({
    gameId: gameIdSchema,
    room: z.enum(["player", "spectator"]).describe("The chat room"),
    text: z.string().trim().min(1).describe("The message to send"),
  }),
  handler: async ({ gameId, room, text }, { client }) => {
    await client.postForm(`/board/game/${encodeURIComponent(gameId)}/chat`, { room, text });
    return `Message sent to ${room} chat in game ${gameId}`;
  },
});

const handleDrawBoardGame = tool({
  name: "handle_draw_board_game",
  description: "Accept or decline a draw offer in a board game",
  schema: z.object({
    gameId: gameIdSchema,
    accept: z.boolean().default(true).describe("Whether to accept or decline the draw offer"),
  }),
  handler: async ({ gameId, accept }, { client }) => {
    await client.post(
      `/board/game/${encodeURIComponent(gameId)}/draw/${accept ? "yes" : "no"}`,
    );
    return `Draw offer ${accept ? "accepted" : "declined"} for game ${gameId}`;
  },
});

const claimVictory = tool({
  name: "claim_victory",
  description: "Claim victory if opponent abandoned the game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/board/game/${encodeURIComponent(gameId)}/claim-victory`);
    return `Victory claimed for game ${gameId}`;
  },
});

const streamEvents = tool({
  name: "stream_events",
  description: "Stream incoming events (challenges and game starts) for the current user",
  schema: z.object({}),
  handler: async (_args, { client }) => {
    const response = await client.request("/stream/event");
    const text = await response.text();
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine ? (JSON.parse(firstLine) as object) : {};
  },
});

const createSeek = tool({
  name: "create_seek",
  description: "Create a public seek to start a game with a random player",
  schema: z.object({
    rated: z.boolean().optional().default(false).describe("Whether the game is rated"),
    time: z.number().min(0).optional().describe("Clock initial time in minutes (real-time)"),
    increment: z.number().int().min(0).optional().describe("Clock increment in seconds (real-time)"),
    days: z.number().int().optional().describe("Days per turn (correspondence)"),
    variant: z
      .enum([
        "standard", "chess960", "crazyhouse", "antichess", "atomic",
        "horde", "kingOfTheHill", "racingKings", "threeCheck",
      ])
      .optional()
      .default("standard"),
    color: z.enum(["random", "white", "black"]).optional(),
    ratingRange: z.string().optional().describe("Rating range, e.g. '1500-1800'"),
  }),
  handler: async ({ time, increment, ...rest }, { client }) => {
    const fields: Record<string, string | number | boolean | undefined> = { ...rest };
    if (time !== undefined) fields.time = time;
    if (increment !== undefined) fields.increment = increment;
    const response = await client.postForm("/board/seek", fields);
    return (await response.text()) || "Seek created";
  },
});

const streamBoardGame = tool({
  name: "stream_board_game",
  description: "Stream the state of a board game (returns first event)",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    const response = await client.request(
      `/board/game/stream/${encodeURIComponent(gameId)}`,
    );
    const text = await response.text();
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine ? (JSON.parse(firstLine) as object) : {};
  },
});

const getBoardGameChat = tool({
  name: "get_board_game_chat",
  description: "Get the chat messages of a board game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) =>
    client.json(`/board/game/${encodeURIComponent(gameId)}/chat`),
});

const handleTakebackBoardGame = tool({
  name: "handle_takeback_board_game",
  description: "Accept or decline a takeback offer in a board game",
  schema: z.object({
    gameId: gameIdSchema,
    accept: z.boolean().default(true).describe("Whether to accept or decline the takeback"),
  }),
  handler: async ({ gameId, accept }, { client }) => {
    await client.post(
      `/board/game/${encodeURIComponent(gameId)}/takeback/${accept ? "yes" : "no"}`,
    );
    return `Takeback ${accept ? "accepted" : "declined"} for game ${gameId}`;
  },
});

const claimDrawBoardGame = tool({
  name: "claim_draw_board_game",
  description: "Claim a draw (e.g., 50-move rule or threefold repetition)",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/board/game/${encodeURIComponent(gameId)}/claim-draw`);
    return `Draw claimed for game ${gameId}`;
  },
});

const berserkBoardGame = tool({
  name: "berserk_board_game",
  description: "Go berserk in a tournament game (halve your clock for extra tournament points)",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/board/game/${encodeURIComponent(gameId)}/berserk`);
    return `Berserked game ${gameId}`;
  },
});

export const boardTools: AnyToolDefinition[] = [
  makeBoardMove,
  makeMove,
  abortBoardGame,
  resignBoardGame,
  writeInChat,
  handleDrawBoardGame,
  claimVictory,
  streamEvents,
  createSeek,
  streamBoardGame,
  getBoardGameChat,
  handleTakebackBoardGame,
  claimDrawBoardGame,
  berserkBoardGame,
];
