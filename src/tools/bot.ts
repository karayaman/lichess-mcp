import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const gameIdSchema = z.string().trim().min(1).describe("The game ID");

const getOnlineBots = tool({
  name: "get_online_bots",
  description: "Stream online bot users",
  schema: z.object({
    nb: z
      .number()
      .int()
      .min(1)
      .max(512)
      .default(100)
      .describe("How many bot users to fetch (max 512)"),
  }),
  handler: async ({ nb }, { client }) =>
    client.ndjson(`/bot/online?nb=${nb}`, { auth: false }),
});

const streamBotGame = tool({
  name: "stream_bot_game",
  description: "Stream the state of a bot game (returns first event)",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    const response = await client.request(`/bot/game/stream/${encodeURIComponent(gameId)}`);
    const text = await response.text();
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine ? (JSON.parse(firstLine) as object) : {};
  },
});

const makeBotMove = tool({
  name: "make_bot_move",
  description: "Make a move in a bot game",
  schema: z.object({
    gameId: gameIdSchema,
    move: z.string().trim().min(1).describe("Move in UCI format (e.g. e2e4)"),
    offeringDraw: z.boolean().optional().describe("Whether to offer a draw"),
  }),
  handler: async ({ gameId, move, offeringDraw }, { client }) => {
    const qs = offeringDraw ? "?offeringDraw=true" : "";
    await client.post(
      `/bot/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(move)}${qs}`,
    );
    return `Move ${move} made in bot game ${gameId}${offeringDraw ? " with draw offer" : ""}`;
  },
});

const writeBotChat = tool({
  name: "write_bot_chat",
  description: "Write in the chat of a bot game",
  schema: z.object({
    gameId: gameIdSchema,
    room: z.enum(["player", "spectator"]).describe("The chat room"),
    text: z.string().trim().min(1).describe("The message to send"),
  }),
  handler: async ({ gameId, room, text }, { client }) => {
    await client.postForm(`/bot/game/${encodeURIComponent(gameId)}/chat`, { room, text });
    return `Message sent to ${room} chat in bot game ${gameId}`;
  },
});

const getBotGameChat = tool({
  name: "get_bot_game_chat",
  description: "Get the chat messages of a bot game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) =>
    client.json(`/bot/game/${encodeURIComponent(gameId)}/chat`),
});

const abortBotGame = tool({
  name: "abort_bot_game",
  description: "Abort a bot game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/bot/game/${encodeURIComponent(gameId)}/abort`);
    return `Bot game ${gameId} aborted`;
  },
});

const resignBotGame = tool({
  name: "resign_bot_game",
  description: "Resign a bot game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/bot/game/${encodeURIComponent(gameId)}/resign`);
    return `Resigned bot game ${gameId}`;
  },
});

const handleBotDraw = tool({
  name: "handle_bot_draw",
  description: "Accept or decline a draw offer in a bot game",
  schema: z.object({
    gameId: gameIdSchema,
    accept: z.boolean().default(true).describe("Whether to accept or decline the draw offer"),
  }),
  handler: async ({ gameId, accept }, { client }) => {
    await client.post(
      `/bot/game/${encodeURIComponent(gameId)}/draw/${accept ? "yes" : "no"}`,
    );
    return `Draw offer ${accept ? "accepted" : "declined"} for bot game ${gameId}`;
  },
});

const handleBotTakeback = tool({
  name: "handle_bot_takeback",
  description: "Accept or decline a takeback offer in a bot game",
  schema: z.object({
    gameId: gameIdSchema,
    accept: z.boolean().default(true).describe("Whether to accept or decline the takeback"),
  }),
  handler: async ({ gameId, accept }, { client }) => {
    await client.post(
      `/bot/game/${encodeURIComponent(gameId)}/takeback/${accept ? "yes" : "no"}`,
    );
    return `Takeback ${accept ? "accepted" : "declined"} for bot game ${gameId}`;
  },
});

const claimBotVictory = tool({
  name: "claim_bot_victory",
  description: "Claim victory if opponent abandoned the bot game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/bot/game/${encodeURIComponent(gameId)}/claim-victory`);
    return `Victory claimed for bot game ${gameId}`;
  },
});

const claimBotDraw = tool({
  name: "claim_bot_draw",
  description: "Claim a draw in a bot game",
  schema: z.object({ gameId: gameIdSchema }),
  handler: async ({ gameId }, { client }) => {
    await client.post(`/bot/game/${encodeURIComponent(gameId)}/claim-draw`);
    return `Draw claimed for bot game ${gameId}`;
  },
});

export const botTools: AnyToolDefinition[] = [
  getOnlineBots,
  streamBotGame,
  makeBotMove,
  writeBotChat,
  getBotGameChat,
  abortBotGame,
  resignBotGame,
  handleBotDraw,
  handleBotTakeback,
  claimBotVictory,
  claimBotDraw,
];
