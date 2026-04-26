import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const broadcastTourIdSchema = z.object({
  broadcastTournamentId: z.string().trim().min(1).describe("The broadcast tournament ID"),
});

const pgnFlags = {
  clocks: z.boolean().optional().describe("Include clocks in PGN comments"),
  comments: z.boolean().optional().describe("Include comments"),
};

const getOfficialBroadcasts = tool({
  name: "get_official_broadcasts",
  description: "Get official Lichess broadcasts (paginated)",
  schema: z.object({
    nb: z.number().int().min(1).optional().describe("Max number of broadcasts to return"),
  }),
  handler: async ({ nb }, { client }) => {
    const qs = nb !== undefined ? `?nb=${nb}` : "";
    return client.ndjson(`/broadcast${qs}`);
  },
});

const getTopBroadcasts = tool({
  name: "get_top_broadcasts",
  description: "Get the top broadcasts (featured tournaments)",
  schema: z.object({
    page: z.number().int().min(1).optional().describe("Page number"),
  }),
  handler: async ({ page }, { client }) => {
    const qs = page !== undefined ? `?page=${page}` : "";
    return client.json(`/broadcast/top${qs}`);
  },
});

const getBroadcastsByUser = tool({
  name: "get_broadcasts_by_user",
  description: "Get broadcasts created by a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the broadcast creator"),
    page: z.number().int().min(1).optional().describe("Page number"),
  }),
  handler: async ({ username, page }, { client }) => {
    const qs = page !== undefined ? `?page=${page}` : "";
    return client.json(`/broadcast/by/${encodeURIComponent(username)}${qs}`);
  },
});

const searchBroadcasts = tool({
  name: "search_broadcasts",
  description: "Search broadcasts",
  schema: z.object({
    q: z.string().trim().min(1).describe("Search query"),
    page: z.number().int().min(1).optional().describe("Page number"),
  }),
  handler: async ({ q, page }, { client }) => {
    const params = new URLSearchParams({ q });
    if (page !== undefined) params.set("page", String(page));
    return client.json(`/broadcast/search?${params.toString()}`);
  },
});

const createBroadcastTournament = tool({
  name: "create_broadcast_tournament",
  description: "Create a new broadcast tournament",
  schema: z.object({
    name: z.string().trim().min(1).describe("Name of the broadcast"),
    shortDescription: z.string().optional().describe("Short description (max 240 chars)"),
    description: z.string().optional().describe("Long description (markdown)"),
    markdown: z.string().optional().describe("Markdown description"),
  }),
  handler: async (fields, { client }) => {
    const response = await client.postForm("/broadcast/new", fields);
    return (await response.json()) as object;
  },
});

const getBroadcastTournament = tool({
  name: "get_broadcast_tournament",
  description: "Get a broadcast tournament by ID",
  schema: broadcastTourIdSchema,
  handler: async ({ broadcastTournamentId }, { client }) =>
    client.json(`/broadcast/${encodeURIComponent(broadcastTournamentId)}`),
});

const getBroadcastPlayers = tool({
  name: "get_broadcast_players",
  description: "Get all players in a broadcast tournament",
  schema: broadcastTourIdSchema,
  handler: async ({ broadcastTournamentId }, { client }) =>
    client.json(`/broadcast/${encodeURIComponent(broadcastTournamentId)}/players`),
});

const getBroadcastPlayer = tool({
  name: "get_broadcast_player",
  description: "Get a specific player in a broadcast tournament",
  schema: z.object({
    broadcastTournamentId: z.string().trim().min(1),
    playerId: z.string().trim().min(1).describe("Player FIDE ID or username"),
  }),
  handler: async ({ broadcastTournamentId, playerId }, { client }) =>
    client.json(
      `/broadcast/${encodeURIComponent(broadcastTournamentId)}/players/${encodeURIComponent(playerId)}`,
    ),
});

const getBroadcastTeamLeaderboard = tool({
  name: "get_broadcast_team_leaderboard",
  description: "Get team standings of a broadcast tournament",
  schema: broadcastTourIdSchema,
  handler: async ({ broadcastTournamentId }, { client }) =>
    client.json(
      `/broadcast/${encodeURIComponent(broadcastTournamentId)}/teams/standings`,
    ),
});

const updateBroadcastTournament = tool({
  name: "update_broadcast_tournament",
  description: "Update a broadcast tournament",
  schema: z.object({
    broadcastTournamentId: z.string().trim().min(1),
    name: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
  }),
  handler: async ({ broadcastTournamentId, ...fields }, { client }) => {
    await client.postForm(
      `/broadcast/${encodeURIComponent(broadcastTournamentId)}/edit`,
      fields,
    );
    return `Broadcast tournament ${broadcastTournamentId} updated`;
  },
});

const createBroadcastRound = tool({
  name: "create_broadcast_round",
  description: "Create a new round in a broadcast tournament",
  schema: z.object({
    broadcastTournamentId: z.string().trim().min(1),
    name: z.string().trim().min(1).describe("Name of the round"),
    startsAt: z.number().int().optional().describe("Scheduled start timestamp"),
  }),
  handler: async ({ broadcastTournamentId, ...fields }, { client }) => {
    const response = await client.postForm(
      `/broadcast/${encodeURIComponent(broadcastTournamentId)}/new`,
      fields,
    );
    return (await response.json()) as object;
  },
});

const getBroadcastRound = tool({
  name: "get_broadcast_round",
  description: "Get a broadcast round by its slug and ID",
  schema: z.object({
    broadcastTournamentSlug: z.string().trim().min(1),
    broadcastRoundSlug: z.string().trim().min(1),
    broadcastRoundId: z.string().trim().min(1),
  }),
  handler: async ({ broadcastTournamentSlug, broadcastRoundSlug, broadcastRoundId }, { client }) =>
    client.json(
      `/broadcast/${encodeURIComponent(broadcastTournamentSlug)}/${encodeURIComponent(broadcastRoundSlug)}/${encodeURIComponent(broadcastRoundId)}`,
    ),
});

const updateBroadcastRound = tool({
  name: "update_broadcast_round",
  description: "Update a broadcast round",
  schema: z.object({
    broadcastRoundId: z.string().trim().min(1).describe("The broadcast round ID"),
    name: z.string().optional(),
    startsAt: z.number().int().optional(),
  }),
  handler: async ({ broadcastRoundId, ...fields }, { client }) => {
    await client.postForm(`/broadcast/round/${encodeURIComponent(broadcastRoundId)}/edit`, fields);
    return `Broadcast round ${broadcastRoundId} updated`;
  },
});

const resetBroadcastRound = tool({
  name: "reset_broadcast_round",
  description: "Reset a broadcast round (clear all games)",
  schema: z.object({
    broadcastRoundId: z.string().trim().min(1).describe("The broadcast round ID"),
  }),
  handler: async ({ broadcastRoundId }, { client }) => {
    await client.post(`/broadcast/round/${encodeURIComponent(broadcastRoundId)}/reset`);
    return `Broadcast round ${broadcastRoundId} reset`;
  },
});

const pushBroadcastRoundPgn = tool({
  name: "push_broadcast_round_pgn",
  description: "Push PGN moves to a broadcast round",
  schema: z.object({
    broadcastRoundId: z.string().trim().min(1).describe("The broadcast round ID"),
    pgn: z.string().trim().min(1).describe("PGN content to push"),
  }),
  handler: async ({ broadcastRoundId, pgn }, { client }) => {
    await client.postText(
      `/broadcast/round/${encodeURIComponent(broadcastRoundId)}/push`,
      pgn,
      "text/plain",
    );
    return `Successfully pushed PGN to broadcast round ${broadcastRoundId}`;
  },
});

const getBroadcastRoundPgn = tool({
  name: "get_broadcast_round_pgn",
  description: "Download all games of a broadcast round as PGN",
  schema: z.object({
    broadcastRoundId: z.string().trim().min(1).describe("The broadcast round ID"),
    ...pgnFlags,
  }),
  handler: async ({ broadcastRoundId, ...flags }, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(flags)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.pgn(`/broadcast/round/${encodeURIComponent(broadcastRoundId)}.pgn${qs}`);
  },
});

const getBroadcastAllRoundsPgn = tool({
  name: "get_broadcast_all_rounds_pgn",
  description: "Download all games of all rounds of a broadcast as PGN",
  schema: z.object({
    broadcastTournamentId: z.string().trim().min(1).describe("The broadcast tournament ID"),
    ...pgnFlags,
  }),
  handler: async ({ broadcastTournamentId, ...flags }, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(flags)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.pgn(`/broadcast/${encodeURIComponent(broadcastTournamentId)}.pgn${qs}`);
  },
});

const getMyBroadcastRounds = tool({
  name: "get_my_broadcast_rounds",
  description: "Get all broadcast rounds managed by the logged-in user",
  schema: z.object({
    nb: z.number().int().min(1).optional().describe("Number of rounds to return"),
  }),
  handler: async ({ nb }, { client }) => {
    const qs = nb !== undefined ? `?nb=${nb}` : "";
    return client.ndjson(`/broadcast/my-rounds${qs}`);
  },
});

export const broadcastsTools: AnyToolDefinition[] = [
  getOfficialBroadcasts,
  getTopBroadcasts,
  getBroadcastsByUser,
  searchBroadcasts,
  createBroadcastTournament,
  getBroadcastTournament,
  getBroadcastPlayers,
  getBroadcastPlayer,
  getBroadcastTeamLeaderboard,
  updateBroadcastTournament,
  createBroadcastRound,
  getBroadcastRound,
  updateBroadcastRound,
  resetBroadcastRound,
  pushBroadcastRoundPgn,
  getBroadcastRoundPgn,
  getBroadcastAllRoundsPgn,
  getMyBroadcastRounds,
];
