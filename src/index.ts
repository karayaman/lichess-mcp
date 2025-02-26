#!/usr/bin/env node

/**
 * This is a Lichess MCP server that implements chess game interactions.
 * It provides:
 * - Listing ongoing games as resources
 * - Reading game states
 * - Creating challenges
 * - Making moves
 * - Getting game analysis
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch, { RequestInit, Response } from 'node-fetch';
// Import dotenv with ESM style
import 'dotenv/config';

/**
 * Type definitions for Lichess data
 */
type Game = {
  id: string;
  status: string;
  fen: string;
  lastMove?: string;
  players: {
    white: { name: string };
    black: { name: string };
  };
};

type GameState = {
  type: 'gameState';
  moves: string;
  status: string;
  winner?: 'white' | 'black';
};

interface LichessResponse {
  nowPlaying: Game[];
}

interface ChallengeResponse {
  challenge: {
    id: string;
    url: string;
  };
}

interface Profile {
  id: string;
  username: string;
  perfs: {
    [key: string]: {
      games: number;
      rating: number;
      prog: number;
    };
  };
  createdAt: number;
  disabled: boolean;
  tosViolation: boolean;
  profile?: {
    country?: string;
    location?: string;
    bio?: string;
    firstName?: string;
    lastName?: string;
    fideRating?: number;
    links?: string;
  };
  seenAt: number;
  patron?: boolean;
  verified: boolean;
  playTime: {
    total: number;
    tv: number;
  };
  title?: string;
  url: string;
  playing?: string;
  completionRate?: number;
  count: {
    all: number;
    rated: number;
    ai: number;
    draw: number;
    drawH: number;
    loss: number;
    lossH: number;
    win: number;
    winH: number;
    bookmark: number;
    playing: number;
    import: number;
    me: number;
  };
  streaming?: boolean;
  followable: boolean;
  following: boolean;
  blocking: boolean;
  followsYou: boolean;
}

interface EmailResponse {
  email: string;
}

interface KidModeResponse {
  kid: boolean;
}

interface Preferences {
  dark: boolean;
  transp: boolean;
  bgImg: string;
  is3d: boolean;
  theme: string;
  pieceSet: string;
  theme3d: string;
  pieceSet3d: string;
  soundSet: string;
  blindfold: number;
  autoQueen: number;
  autoThreefold: number;
  takeback: number;
  moretime: number;
  clockTenths: number;
  clockBar: boolean;
  clockSound: boolean;
  premove: boolean;
  animation: number;
  captured: boolean;
  follow: boolean;
  highlight: boolean;
  destination: boolean;
  coords: number;
  replay: number;
  challenge: number;
  message: number;
  coordColor: number;
  submitMove: number;
  confirmResign: number;
  insightShare: number;
  keyboardMove: number;
  zen: number;
  moveEvent: number;
  rookCastle: number;
}

interface TimelineEntry {
  type: string;
  data: Record<string, any>;
  date: number;
}

interface TokenTestResult {
  [token: string]: {
    userId: string;
    scopes: string[];
  } | null;
}

/**
 * Lichess API configuration
 */
const LICHESS_API_URL = 'https://lichess.org/api';
let LICHESS_TOKEN: string | undefined = process.env.LICHESS_TOKEN;

const server = new Server(
  {
    name: "lichess-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Helper function to make authenticated requests to Lichess API
 */
async function lichessRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (!LICHESS_TOKEN) {
    throw new Error('Lichess API token not set. Use the set_token tool first.');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      'Authorization': `Bearer ${LICHESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  const response = await fetch(`${LICHESS_API_URL}${endpoint}`, fetchOptions);

  if (!response.ok) {
    throw new Error(`Lichess API error: ${response.statusText}`);
  }

  return response;
}

/**
 * Handler that lists available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "set_token",
        description: "Set your Lichess API token",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Your Lichess API token"
            }
          },
          required: ["token"]
        }
      },
      {
        name: "get_my_profile",
        description: "Get your Lichess profile information",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_user_profile",
        description: "Get a user's Lichess profile information",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            },
            trophies: {
              type: "boolean",
              description: "Include user trophies",
              default: false
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_my_email",
        description: "Get your email address",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_kid_mode",
        description: "Get kid mode status",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "set_kid_mode",
        description: "Set kid mode status",
        inputSchema: {
          type: "object",
          properties: {
            value: {
              type: "boolean",
              description: "Enable or disable kid mode"
            }
          },
          required: ["value"]
        }
      },
      {
        name: "create_challenge",
        description: "Create a new challenge",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to challenge"
            },
            timeControl: {
              type: "string",
              description: "Time control (e.g. '10+0' for 10 minutes)",
              default: "10+0"
            },
            color: {
              type: "string",
              enum: ["white", "black", "random"],
              default: "random"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "make_move",
        description: "Make a move in an ongoing game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "ID of the game"
            },
            move: {
              type: "string",
              description: "Move in UCI format (e.g. 'e2e4')"
            },
            offeringDraw: {
              type: "boolean",
              description: "Whether to offer/accept a draw",
              default: false
            }
          },
          required: ["gameId", "move"]
        }
      },
      {
        name: "get_preferences",
        description: "Get your preferences",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_timeline",
        description: "Get your timeline",
        inputSchema: {
          type: "object",
          properties: {
            since: {
              type: "number",
              description: "Show events since this timestamp"
            },
            nb: {
              type: "number",
              description: "Max number of events to fetch (1-30)",
              minimum: 1,
              maximum: 30,
              default: 15
            }
          }
        }
      },
      {
        name: "test_tokens",
        description: "Test multiple OAuth tokens",
        inputSchema: {
          type: "object",
          properties: {
            tokens: {
              type: "string",
              description: "OAuth tokens separated by commas. Up to 1000."
            }
          },
          required: ["tokens"]
        }
      },
      {
        name: "revoke_token",
        description: "Revoke the current access token",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "upgrade_to_bot",
        description: "Upgrade to Bot account. WARNING: This is irreversible and the account must not have played any games.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "add_user_note",
        description: "Add a private note about a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            },
            text: {
              type: "string",
              description: "The contents of the note"
            }
          },
          required: ["username", "text"]
        }
      },
      {
        name: "send_message",
        description: "Send a private message to another player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the recipient"
            },
            text: {
              type: "string",
              description: "Message text"
            }
          },
          required: ["username", "text"]
        }
      },
      {
        name: "get_following",
        description: "Get users followed by the logged in user",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "follow_user",
        description: "Follow a player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to follow"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "unfollow_user",
        description: "Unfollow a player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to unfollow"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "block_user",
        description: "Block a player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to block"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_users_status",
        description: "Get real-time users status",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "string",
              description: "User IDs separated by commas. Up to 100 IDs."
            },
            withSignal: {
              type: "boolean",
              description: "Include network signal strength (1-4)"
            },
            withGameIds: {
              type: "boolean",
              description: "Include IDs of ongoing games"
            },
            withGameMetas: {
              type: "boolean",
              description: "Include metadata of ongoing games"
            }
          },
          required: ["ids"]
        }
      },
      {
        name: "get_all_top_10",
        description: "Get the top 10 players for each speed and variant",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_leaderboard",
        description: "Get the leaderboard for a single speed or variant",
        inputSchema: {
          type: "object",
          properties: {
            nb: {
              type: "number",
              description: "How many users to fetch (1-200)",
              minimum: 1,
              maximum: 200,
              default: 100
            },
            perfType: {
              type: "string",
              description: "The speed or variant",
              enum: ["ultraBullet", "bullet", "blitz", "rapid", "classical", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"]
            }
          },
          required: ["perfType"]
        }
      },
      {
        name: "get_user_public_data",
        description: "Get public data of a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            },
            withTrophies: {
              type: "boolean",
              description: "Include user trophies",
              default: false
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_rating_history",
        description: "Get rating history of a user for all perf types",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_user_performance",
        description: "Get performance statistics of a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            },
            perf: {
              type: "string",
              description: "The speed or variant",
              enum: ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"]
            }
          },
          required: ["username", "perf"]
        }
      },
      {
        name: "get_user_activity",
        description: "Get activity feed of a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_users_by_id",
        description: "Get multiple users by their IDs",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "string",
              description: "User IDs separated by commas. Up to 300 IDs."
            }
          },
          required: ["ids"]
        }
      },
      {
        name: "unblock_user",
        description: "Unblock a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to unblock"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "export_game",
        description: "Export one game in PGN or JSON format",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            },
            moves: {
              type: "boolean",
              description: "Include the PGN moves",
              default: true
            },
            pgnInJson: {
              type: "boolean",
              description: "Include the full PGN within the JSON response",
              default: false
            },
            tags: {
              type: "boolean",
              description: "Include the PGN tags",
              default: true
            },
            clocks: {
              type: "boolean",
              description: "Include clock comments in the PGN moves",
              default: true
            },
            evals: {
              type: "boolean",
              description: "Include analysis evaluation comments",
              default: true
            },
            accuracy: {
              type: "boolean",
              description: "Include accuracy percentages",
              default: false
            },
            opening: {
              type: "boolean",
              description: "Include opening name",
              default: true
            },
            literate: {
              type: "boolean",
              description: "Include textual annotations",
              default: false
            }
          },
          required: ["gameId"]
        }
      },
      {
        name: "export_ongoing_game",
        description: "Export ongoing game of a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "The username"
            },
            moves: {
              type: "boolean",
              description: "Include the PGN moves",
              default: true
            },
            pgnInJson: {
              type: "boolean",
              description: "Include the full PGN within the JSON response",
              default: false
            },
            tags: {
              type: "boolean",
              description: "Include the PGN tags",
              default: true
            },
            clocks: {
              type: "boolean",
              description: "Include clock comments in the PGN moves",
              default: true
            },
            evals: {
              type: "boolean",
              description: "Include analysis evaluation comments",
              default: true
            },
            opening: {
              type: "boolean",
              description: "Include opening name",
              default: true
            }
          },
          required: ["username"]
        }
      },
      {
        name: "export_user_games",
        description: "Export all games of a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "The username"
            },
            since: {
              type: "number",
              description: "Download games played since timestamp"
            },
            until: {
              type: "number",
              description: "Download games played until timestamp"
            },
            max: {
              type: "number",
              description: "Maximum number of games to download"
            },
            vs: {
              type: "string",
              description: "Only games against this opponent"
            },
            rated: {
              type: "boolean",
              description: "Only rated (true) or casual (false) games"
            },
            perfType: {
              type: "string",
              description: "Only games in these speeds or variants",
              enum: ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"]
            },
            color: {
              type: "string",
              description: "Only games played as this color",
              enum: ["white", "black"]
            },
            analysed: {
              type: "boolean",
              description: "Only games with or without computer analysis"
            },
            moves: {
              type: "boolean",
              description: "Include moves",
              default: true
            },
            tags: {
              type: "boolean",
              description: "Include tags",
              default: true
            },
            clocks: {
              type: "boolean",
              description: "Include clock comments",
              default: false
            },
            evals: {
              type: "boolean",
              description: "Include analysis",
              default: false
            },
            accuracy: {
              type: "boolean",
              description: "Include accuracy",
              default: false
            },
            opening: {
              type: "boolean",
              description: "Include opening",
              default: false
            },
            ongoing: {
              type: "boolean",
              description: "Include ongoing games",
              default: false
            },
            finished: {
              type: "boolean",
              description: "Include finished games",
              default: true
            },
            literate: {
              type: "boolean",
              description: "Include textual annotations",
              default: false
            },
            lastFen: {
              type: "boolean",
              description: "Include last position FEN",
              default: false
            },
            sort: {
              type: "string",
              description: "Sort order of games",
              enum: ["dateAsc", "dateDesc"],
              default: "dateDesc"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "export_games_by_ids",
        description: "Export multiple games by IDs",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "string",
              description: "Game IDs separated by commas. Up to 300 IDs."
            },
            moves: {
              type: "boolean",
              description: "Include the PGN moves",
              default: true
            },
            pgnInJson: {
              type: "boolean",
              description: "Include the full PGN within the JSON response",
              default: false
            },
            tags: {
              type: "boolean",
              description: "Include the PGN tags",
              default: true
            },
            clocks: {
              type: "boolean",
              description: "Include clock comments",
              default: false
            },
            evals: {
              type: "boolean",
              description: "Include analysis",
              default: false
            },
            opening: {
              type: "boolean",
              description: "Include opening name",
              default: false
            }
          },
          required: ["ids"]
        }
      },
      {
        name: "get_tv_channels",
        description: "Get all TV channels and their current games",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_tv_game",
        description: "Get current TV game in PGN format",
        inputSchema: {
          type: "object",
          properties: {
            channel: {
              type: "string",
              description: "Channel name like 'bot', 'blitz', etc.",
              enum: [        "bot",
                "blitz",
                "racingKings",
                "ultraBullet",
                "bullet",
                "classical",
                "threeCheck",
                "antichess",
                "computer",
                "horde",
                "rapid",
                "atomic",
                "crazyhouse",
                "chess960",
                "kingOfTheHill",
                "best"]
            }
          }
        }
      },
      {
        name: "get_puzzle_activity",
        description: "Get your puzzle activity",
        inputSchema: {
          type: "object",
          properties: {
            max: {
              type: "number",
              description: "How many entries to download. Leave empty to get all activity.",
              minimum: 1,
              maximum: 200
            }
          }
        }
      },
      {
        name: "get_puzzle_dashboard",
        description: "Get your puzzle dashboard",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "How many days of history to return (max 30)",
              minimum: 1,
              maximum: 30,
              default: 30
            }
          }
        }
      },
      {
        name: "get_puzzle_race",
        description: "Get info about a puzzle race",
        inputSchema: {
          type: "object",
          properties: {
            raceId: {
              type: "string",
              description: "ID of the puzzle race"
            }
          },
          required: ["raceId"]
        }
      },
      {
        name: "create_puzzle_race",
        description: "Create a puzzle race",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_puzzle_storm_dashboard",
        description: "Get your puzzle storm dashboard",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "How many days of history to return (max 30)",
              minimum: 1,
              maximum: 30,
              default: 30
            }
          }
        }
      },
      {
        name: "get_team_info",
        description: "Get team information by ID",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            }
          },
          required: ["teamId"]
        }
      },
      {
        name: "get_team_members",
        description: "Get members of a team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            },
            max: {
              type: "number",
              description: "Maximum number of members to fetch",
              default: 100
            }
          },
          required: ["teamId"]
        }
      },
      {
        name: "get_team_join_requests",
        description: "Get join requests for a team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            }
          },
          required: ["teamId"]
        }
      },
      {
        name: "join_team",
        description: "Join a team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            },
            message: {
              type: "string",
              description: "Optional message for team leaders"
            }
          },
          required: ["teamId"]
        }
      },
      {
        name: "leave_team",
        description: "Leave a team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            }
          },
          required: ["teamId"]
        }
      },
      {
        name: "kick_user_from_team",
        description: "Kick a user from your team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            },
            userId: {
              type: "string",
              description: "The user ID"
            }
          },
          required: ["teamId", "userId"]
        }
      },
      {
        name: "accept_join_request",
        description: "Accept a join request for your team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            },
            userId: {
              type: "string",
              description: "The user ID"
            }
          },
          required: ["teamId", "userId"]
        }
      },
      {
        name: "decline_join_request",
        description: "Decline a join request for your team",
        inputSchema: {
          type: "object",
          properties: {
            teamId: {
              type: "string",
              description: "The team ID"
            },
            userId: {
              type: "string",
              description: "The user ID"
            }
          },
          required: ["teamId", "userId"]
        }
      },
      {
        name: "search_teams",
        description: "Search for teams",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Search text"
            },
            page: {
              type: "number",
              description: "Page number (starting at 1)",
              default: 1
            }
          },
          required: ["text"]
        }
      },
      {
        name: "make_board_move",
        description: "Make a move in a board game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            },
            move: {
              type: "string",
              description: "Move in UCI format (e.g. e2e4)"
            },
            offeringDraw: {
              type: "boolean",
              description: "Whether to offer/accept a draw",
              default: false
            }
          },
          required: ["gameId", "move"]
        }
      },
      {
        name: "abort_board_game",
        description: "Abort a board game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            }
          },
          required: ["gameId"]
        }
      },
      {
        name: "resign_board_game",
        description: "Resign a board game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            }
          },
          required: ["gameId"]
        }
      },
      {
        name: "write_in_chat",
        description: "Write in the chat of a board game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            },
            room: {
              type: "string",
              description: "The chat room",
              enum: ["player", "spectator"]
            },
            text: {
              type: "string",
              description: "The message to send"
            }
          },
          required: ["gameId", "room", "text"]
        }
      },
      {
        name: "handle_draw_board_game",
        description: "Handle draw offers for a board game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            },
            accept: {
              type: "boolean",
              description: "Whether to accept or decline the draw offer",
              default: true
            }
          },
          required: ["gameId"]
        }
      },
      {
        name: "claim_victory",
        description: "Claim victory if opponent abandoned the game",
        inputSchema: {
          type: "object",
          properties: {
            gameId: {
              type: "string",
              description: "The game ID"
            }
          },
          required: ["gameId"]
        }
      },
      {
        name: "list_challenges",
        description: "List incoming and outgoing challenges",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "create_challenge",
        description: "Challenge another player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player to challenge"
            },
            rated: {
              type: "boolean",
              description: "Whether the game is rated",
              default: false
            },
            clock: {
              type: "object",
              description: "Clock settings",
              properties: {
                limit: {
                  type: "number",
                  description: "Clock initial time in minutes"
                },
                increment: {
                  type: "number",
                  description: "Clock increment in seconds"
                }
              }
            },
            days: {
              type: "number",
              description: "Days per turn for correspondence games"
            },
            color: {
              type: "string",
              description: "Color to play",
              enum: ["random", "white", "black"]
            },
            variant: {
              type: "string",
              description: "Game variant",
              enum: ["standard", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"],
              default: "standard"
            },
            fen: {
              type: "string",
              description: "Custom initial position in FEN format"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "accept_challenge",
        description: "Accept an incoming challenge",
        inputSchema: {
          type: "object",
          properties: {
            challengeId: {
              type: "string",
              description: "ID of the challenge to accept"
            }
          },
          required: ["challengeId"]
        }
      },
      {
        name: "decline_challenge",
        description: "Decline an incoming challenge",
        inputSchema: {
          type: "object",
          properties: {
            challengeId: {
              type: "string",
              description: "ID of the challenge to decline"
            },
            reason: {
              type: "string",
              description: "Reason for declining",
              enum: ["generic", "later", "tooFast", "tooSlow", "timeControl", "rated", "casual", "standard", "variant", "noBot", "onlyBot"]
            }
          },
          required: ["challengeId"]
        }
      },
      {
        name: "cancel_challenge",
        description: "Cancel an outgoing challenge",
        inputSchema: {
          type: "object",
          properties: {
            challengeId: {
              type: "string",
              description: "ID of the challenge to cancel"
            }
          },
          required: ["challengeId"]
        }
      },
      {
        name: "get_arena_tournaments",
        description: "Get current tournaments",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "create_arena",
        description: "Create a new arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the tournament"
            },
            clockTime: {
              type: "number",
              description: "Clock initial time in minutes",
              default: 3
            },
            clockIncrement: {
              type: "number",
              description: "Clock increment in seconds",
              default: 2
            },
            minutes: {
              type: "number",
              description: "Tournament duration in minutes",
              default: 45
            },
            waitMinutes: {
              type: "number",
              description: "Time before tournament starts, in minutes",
              default: 5
            },
            startDate: {
              type: "number",
              description: "Timestamp to start the tournament at a given date"
            },
            variant: {
              type: "string",
              description: "Variant key",
              enum: ["standard", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"],
              default: "standard"
            },
            rated: {
              type: "boolean",
              description: "Whether the tournament is rated",
              default: true
            },
            position: {
              type: "string",
              description: "Custom initial position in FEN format"
            },
            berserkable: {
              type: "boolean",
              description: "Whether players can use berserk",
              default: true
            },
            streakable: {
              type: "boolean",
              description: "Whether players can get streaks",
              default: true
            },
            hasChat: {
              type: "boolean",
              description: "Whether players can discuss in a chat",
              default: true
            },
            description: {
              type: "string",
              description: "Tournament description (HTML)"
            },
            conditions: {
              type: "object",
              description: "Restrict participation",
              properties: {
                nbRatedGame: {
                  type: "number",
                  description: "Minimum number of rated games required"
                },
                minRating: {
                  type: "number",
                  description: "Minimum rating required"
                },
                maxRating: {
                  type: "number",
                  description: "Maximum rating allowed"
                },
                teamMember: {
                  type: "string",
                  description: "Team ID required to join"
                },
                allowList: {
                  type: "string",
                  description: "List of usernames allowed to join"
                }
              }
            }
          },
          required: ["name"]
        }
      },
      {
        name: "get_arena_info",
        description: "Get info about an arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "get_arena_games",
        description: "Get games of an arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "get_arena_results",
        description: "Get results of an arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "join_arena",
        description: "Join an arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "withdraw_from_arena",
        description: "Withdraw from an arena tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "get_team_battle_results",
        description: "Get results of a team battle tournament",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: {
              type: "string",
              description: "Tournament ID"
            }
          },
          required: ["tournamentId"]
        }
      },
      {
        name: "create_swiss",
        description: "Create a new Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the tournament"
            },
            teamId: {
              type: "string",
              description: "ID of the team hosting the tournament"
            },
            clock: {
              type: "object",
              description: "Clock settings",
              properties: {
                limit: {
                  type: "number",
                  description: "Clock initial time in seconds"
                },
                increment: {
                  type: "number",
                  description: "Clock increment in seconds"
                }
              },
              required: ["limit", "increment"]
            },
            nbRounds: {
              type: "number",
              description: "Number of rounds to play",
              default: 7
            },
            variant: {
              type: "string",
              description: "Variant key",
              enum: ["standard", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"],
              default: "standard"
            },
            rated: {
              type: "boolean",
              description: "Whether the tournament is rated",
              default: true
            },
            description: {
              type: "string",
              description: "Tournament description (HTML)"
            },
            roundInterval: {
              type: "number",
              description: "Interval between rounds in seconds",
              default: 300
            }
          },
          required: ["name", "teamId", "clock"]
        }
      },
      {
        name: "get_swiss_info",
        description: "Get info about a Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            swissId: {
              type: "string",
              description: "Swiss tournament ID"
            }
          },
          required: ["swissId"]
        }
      },
      {
        name: "get_swiss_games",
        description: "Get games of a Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            swissId: {
              type: "string",
              description: "Swiss tournament ID"
            }
          },
          required: ["swissId"]
        }
      },
      {
        name: "get_swiss_results",
        description: "Get results of a Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            swissId: {
              type: "string",
              description: "Swiss tournament ID"
            }
          },
          required: ["swissId"]
        }
      },
      {
        name: "join_swiss",
        description: "Join a Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            swissId: {
              type: "string",
              description: "Swiss tournament ID"
            }
          },
          required: ["swissId"]
        }
      },
      {
        name: "withdraw_from_swiss",
        description: "Withdraw from a Swiss tournament",
        inputSchema: {
          type: "object",
          properties: {
            swissId: {
              type: "string",
              description: "Swiss tournament ID"
            }
          },
          required: ["swissId"]
        }
      },
      {
        name: "get_current_simuls",
        description: "Get recently started simuls",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "create_simul",
        description: "Create a new simul",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the simul"
            },
            variant: {
              type: "string",
              description: "Variant key",
              enum: ["standard", "chess960", "crazyhouse", "antichess", "atomic", "horde", "kingOfTheHill", "racingKings", "threeCheck"],
              default: "standard"
            },
            clockTime: {
              type: "number",
              description: "Clock initial time in minutes",
              default: 5
            },
            clockIncrement: {
              type: "number",
              description: "Clock increment in seconds",
              default: 3
            },
            minRating: {
              type: "number",
              description: "Minimum rating to join"
            },
            maxRating: {
              type: "number",
              description: "Maximum rating to join"
            },
            color: {
              type: "string",
              description: "Color the host will play",
              enum: ["white", "black"],
              default: "white"
            },
            text: {
              type: "string",
              description: "Description of the simul"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "join_simul",
        description: "Join a simul",
        inputSchema: {
          type: "object",
          properties: {
            simulId: {
              type: "string",
              description: "ID of the simul"
            }
          },
          required: ["simulId"]
        }
      },
      {
        name: "withdraw_from_simul",
        description: "Withdraw from a simul",
        inputSchema: {
          type: "object",
          properties: {
            simulId: {
              type: "string",
              description: "ID of the simul"
            }
          },
          required: ["simulId"]
        }
      },
      {
        name: "export_study_chapter",
        description: "Export one study chapter in PGN format",
        inputSchema: {
          type: "object",
          properties: {
            studyId: {
              type: "string",
              description: "Study ID"
            },
            chapterId: {
              type: "string",
              description: "Chapter ID"
            }
          },
          required: ["studyId", "chapterId"]
        }
      },
      {
        name: "export_all_study_chapters",
        description: "Export all chapters of a study in PGN format",
        inputSchema: {
          type: "object",
          properties: {
            studyId: {
              type: "string",
              description: "Study ID"
            }
          },
          required: ["studyId"]
        }
      },
      {
        name: "get_user_studies",
        description: "Get studies created by a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the player"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "send_message",
        description: "Send a private message to another player",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the recipient"
            },
            text: {
              type: "string",
              description: "Message text"
            }
          },
          required: ["username", "text"]
        }
      },
      {
        name: "get_thread",
        description: "Get a message thread",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID of the other person"
            }
          },
          required: ["userId"]
        }
      },
      {
        name: "get_official_broadcasts",
        description: "Get official broadcasts (TV shows)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_broadcast",
        description: "Get a broadcast by its ID",
        inputSchema: {
          type: "object",
          properties: {
            broadcastId: {
              type: "string",
              description: "ID of the broadcast"
            }
          },
          required: ["broadcastId"]
        }
      },
      {
        name: "get_broadcast_round",
        description: "Get one round of a broadcast",
        inputSchema: {
          type: "object",
          properties: {
            broadcastId: {
              type: "string",
              description: "ID of the broadcast"
            },
            roundId: {
              type: "string",
              description: "ID of the round"
            }
          },
          required: ["broadcastId", "roundId"]
        }
      },
      {
        name: "push_broadcast_round_pgn",
        description: "Push PGN to a broadcast round",
        inputSchema: {
          type: "object",
          properties: {
            broadcastId: {
              type: "string",
              description: "ID of the broadcast"
            },
            roundId: {
              type: "string",
              description: "ID of the round"
            },
            pgn: {
              type: "string",
              description: "PGN games to push"
            }
          },
          required: ["broadcastId", "roundId", "pgn"]
        }
      },
      {
        name: "get_cloud_eval",
        description: "Get cloud evaluation for a position",
        inputSchema: {
          type: "object",
          properties: {
            fen: {
              type: "string",
              description: "FEN of the position to analyze"
            },
            multiPv: {
              type: "number",
              description: "Number of principal variations (1-5)",
              minimum: 1,
              maximum: 5,
              default: 1
            }
          },
          required: ["fen"]
        }
      },
      {
        name: "get_fide_player",
        description: "Get FIDE player information",
        inputSchema: {
          type: "object",
          properties: {
            playerId: {  // Changed from username
              type: "string",
              description: "FIDE player ID"
            }
          },
          required: ["playerId"]
        }
      },
      {
        name: "search_fide_players",
        description: "Search FIDE players by name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the player to search"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "get_ongoing_games",
        description: "Get your ongoing games (real-time and correspondence)",
        inputSchema: {
          type: "object",
          properties: {
            nb: {
              type: "integer",
              description: "Max number of games to fetch (1-50)",
              minimum: 1,
              maximum: 50,
              default: 9
            }
          }
        }
      }
    ]
  };
});

/**
 * Handler for tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "set_token": {
      const token = String(request.params.arguments?.token);
      if (!token) {
        throw new Error("Token is required");
      }
      LICHESS_TOKEN = token;
      return {
        content: [{
          type: "text",
          text: "Lichess API token has been set"
        }]
      };
    }

    case "get_my_profile": {
      const response = await lichessRequest('/account');
      const profile = await response.json() as Profile;
      return {
        content: [{
          type: "text",
          text: JSON.stringify(profile, null, 2)
        }]
      };
    }

    case "get_user_profile": {
      const username = String(request.params.arguments?.username);
      const trophies = Boolean(request.params.arguments?.trophies);
      const response = await lichessRequest(`/user/${username}${trophies ? '?trophies=true' : ''}`);
      const profile = await response.json() as Profile;
      return {
        content: [{
          type: "text",
          text: JSON.stringify(profile, null, 2)
        }]
      };
    }

    case "get_my_email": {
      const response = await lichessRequest('/account/email');
      const emailData = await response.json() as EmailResponse;
      return {
        content: [{
          type: "text",
          text: `Your email address is: ${emailData.email}`
        }]
      };
    }

    case "get_kid_mode": {
      const response = await lichessRequest('/account/kid');
      const kidData = await response.json() as KidModeResponse;
      return {
        content: [{
          type: "text",
          text: `Kid mode is ${kidData.kid ? 'enabled' : 'disabled'}`
        }]
      };
    }

    case "set_kid_mode": {
      const value = Boolean(request.params.arguments?.value);
      await lichessRequest(`/account/kid?v=${value}`, {
        method: 'POST'
      });
      return {
        content: [{
          type: "text",
          text: `Kid mode has been ${value ? 'enabled' : 'disabled'}`
        }]
      };
    }

    case "create_challenge": {
      const username = String(request.params.arguments?.username);
      const params = new URLSearchParams();

      // Add basic parameters
      if (request.params.arguments?.rated !== undefined) {
        params.append('rated', String(request.params.arguments.rated));
      }
      if (request.params.arguments?.color) {
        params.append('color', String(request.params.arguments.color));
      }
      if (request.params.arguments?.variant) {
        params.append('variant', String(request.params.arguments.variant));
      }

      // Add clock settings if provided
      if (request.params.arguments?.clock) {
        const clock = request.params.arguments.clock as { limit?: number; increment?: number };
        if (clock.limit !== undefined) {
          params.append('clock.limit', String(clock.limit * 60)); // Convert minutes to seconds
        }
        if (clock.increment !== undefined) {
          params.append('clock.increment', String(clock.increment));
        }
      }

      // Add days for correspondence games
      if (request.params.arguments?.days) {
        params.append('days', String(request.params.arguments.days));
      }

      // Add custom initial position if provided
      if (request.params.arguments?.fen) {
        params.append('fen', String(request.params.arguments.fen));
      }

      const response = await lichessRequest(`/challenge/${username}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const challenge = await response.json() as ChallengeResponse;
      return {
        content: [{
          type: "text",
          text: `Challenge created: ${challenge.challenge.url}`
        }]
      };
    }

    case "make_move": {
      const gameId = String(request.params.arguments?.gameId);
      const move = String(request.params.arguments?.move);
      const offeringDraw = Boolean(request.params.arguments?.offeringDraw);

      const url = new URL(`/board/game/${gameId}/move/${move}`, LICHESS_API_URL);
      if (offeringDraw) {
        url.searchParams.append('offeringDraw', 'true');
      }

      await lichessRequest(url.pathname + url.search, {
        method: 'POST'
      });

      return {
        content: [{
          type: "text",
          text: `Move ${move} made in game ${gameId}${offeringDraw ? ' with draw offer' : ''}`
        }]
      };
    }

    case "get_preferences": {
      const response = await lichessRequest('/account/preferences');
      const preferences = await response.json() as Preferences;
      return {
        content: [{
          type: "text",
          text: JSON.stringify(preferences, null, 2)
        }]
      };
    }

    case "get_timeline": {
      const since = request.params.arguments?.since;
      const nb = request.params.arguments?.nb || 15;
      
      const queryParams = new URLSearchParams();
      if (since) queryParams.append('since', String(since));
      if (nb) queryParams.append('nb', String(nb));

      const response = await lichessRequest(`/timeline?${queryParams.toString()}`);
      const timeline = await response.json() as TimelineEntry[];
      return {
        content: [{
          type: "text",
          text: JSON.stringify(timeline, null, 2)
        }]
      };
    }

    case "test_tokens": {
      const tokens = String(request.params.arguments?.tokens);
      if (!tokens) {
        throw new Error("Tokens parameter is required");
      }
      
      const tokenCount = tokens.split(',').length;
      if (tokenCount > 1000) {
        throw new Error("Maximum of 1000 tokens allowed");
      }

      // Don't use lichessRequest here since we don't want to add the auth header
      const response = await fetch(`${LICHESS_API_URL}/token/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: tokens
      });

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.statusText}`);
      }

      const results = await response.json() as TokenTestResult;
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    }

    case "revoke_token": {
      if (!LICHESS_TOKEN) {
        throw new Error('No token set to revoke. Please set a token first using set_token.');
      }

      try {
        const response = await fetch(`${LICHESS_API_URL}/token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${LICHESS_TOKEN}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to revoke token: ${response.statusText}`);
        }

        // Successfully revoked - clear the token
          LICHESS_TOKEN = undefined;

          return {
            content: [{
              type: "text",
            text: "Access token has been successfully revoked and cleared"
            }]
          };
      } catch (error: any) {
        // If there was an error, don't clear the token as it may not have been revoked
        throw new Error(`Failed to revoke token: ${error.message || 'Unknown error'}`);
      }
    }

    case "upgrade_to_bot": {
      await lichessRequest('/bot/account/upgrade', {
        method: 'POST'
      });

          return {
            content: [{
              type: "text",
          text: "Account has been successfully upgraded to a Bot account. The account can now only play as a Bot."
        }]
      };
    }

    case "add_user_note": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }

      const text = String(request.params.arguments?.text);
      if (!text) {
        throw new Error('Text parameter is required');
      }

      try {
      const response = await lichessRequest(`/user/${username}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ text }).toString()
      });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to add note: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Note successfully added for user ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to add note: ${error.message || 'Unknown error'}`);
      }
    }

    case "send_message": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }

      const text = String(request.params.arguments?.text);
      if (!text) {
        throw new Error('Text parameter is required');
      }

      try {
      const response = await lichessRequest(`/inbox/${username}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ text }).toString()
      });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Message successfully sent to ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_following": {
      try {
        const response = await lichessRequest('/rel/following');
          
        if (!response.ok) {
          throw new Error(`Failed to get following list: ${response.statusText}`);
        }
    
        // Read the response as text
        const text = await response.text();
        
        // Split by newlines and parse each line as JSON
        const following = text
          .split('\n')
          .filter(line => line.trim()) // Remove empty lines
          .map(line => JSON.parse(line));
    
        return {
          content: [{
            type: "text",
            text: JSON.stringify(following, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get following list: ${error.message || 'Unknown error'}`);
      }
    }

    case "follow_user": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }

      try {
      const response = await lichessRequest(`/rel/follow/${username}`, {
        method: 'POST'
      });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          if (response.status === 400) {
            throw new Error(`Cannot follow ${username}: invalid request (you may be trying to follow yourself)`);
          }
          throw new Error(`Failed to follow user: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully following ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to follow user: ${error.message || 'Unknown error'}`);
      }
    }

    case "unfollow_user": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }

      try {
      const response = await lichessRequest(`/rel/unfollow/${username}`, {
        method: 'POST'
      });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to unfollow user: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully unfollowed ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to unfollow user: ${error.message || 'Unknown error'}`);
      }
    }

    case "block_user": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }

      try {
      const response = await lichessRequest(`/rel/block/${username}`, {
        method: 'POST'
      });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to block user: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully blocked ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to block user: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_users_status": {
      const ids = String(request.params.arguments?.ids);
      if (!ids) {
        throw new Error('IDs parameter is required');
      }

      const idList = ids.split(',');
      if (idList.length > 100) {
        throw new Error('Maximum of 100 user IDs allowed');
      }

      const withSignal = Boolean(request.params.arguments?.withSignal);
      const withGameIds = Boolean(request.params.arguments?.withGameIds);
      const withGameMetas = Boolean(request.params.arguments?.withGameMetas);

      try {
        const params = new URLSearchParams();
        if (withSignal) params.append('withSignal', 'true');
        if (withGameIds) params.append('withGameIds', 'true');
        if (withGameMetas) params.append('withGameMetas', 'true');

        const response = await lichessRequest(`/users/status?ids=${ids}&${params.toString()}`);

      if (!response.ok) {
          throw new Error(`Failed to get user statuses: ${response.statusText}`);
      }

        const status = await response.json();
      return {
        content: [{
          type: "text",
            text: JSON.stringify(status, null, 2)
        }]
      };
      } catch (error: any) {
        throw new Error(`Failed to get user statuses: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_all_top_10": {
      const response = await lichessRequest('/player');
      const top10s = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(top10s, null, 2)
        }]
      };
    }

    case "get_leaderboard": {
      const perfType = String(request.params.arguments?.perfType);
      if (!perfType) {
        throw new Error('perfType parameter is required');
      }

      const validPerfTypes = [
        "ultraBullet", "bullet", "blitz", "rapid", "classical", 
        "chess960", "crazyhouse", "antichess", "atomic", "horde", 
        "kingOfTheHill", "racingKings", "threeCheck"
      ];
      if (!validPerfTypes.includes(perfType)) {
        throw new Error(`Invalid perfType. Must be one of: ${validPerfTypes.join(', ')}`);
      }

      const nb = Number(request.params.arguments?.nb) || 100;
      if (nb < 1 || nb > 200) {
        throw new Error('nb parameter must be between 1 and 200');
      }
      
      const response = await lichessRequest(`/player/top/${nb}/${perfType}`);
      const leaderboard = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(leaderboard, null, 2)
        }]
      };
    }

    case "get_user_public_data": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      const withTrophies = Boolean(request.params.arguments?.withTrophies);
      const params = new URLSearchParams();
      if (withTrophies) {
        params.append('trophies', 'true');
      }

      try {
        const response = await lichessRequest(`/user/${username}?${params.toString()}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to get user data: ${response.statusText}`);
        }
      const userData = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(userData, null, 2)
        }]
      };
      } catch (error: any) {
        throw new Error(`Failed to get user data: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_rating_history": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      try {
      const response = await lichessRequest(`/user/${username}/rating-history`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to get rating history: ${response.statusText}`);
        }
      const ratingHistory = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(ratingHistory, null, 2)
        }]
      };
      } catch (error: any) {
        throw new Error(`Failed to get rating history: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_user_performance": {
      const username = String(request.params.arguments?.username);
      const perf = String(request.params.arguments?.perf);
      
      const response = await lichessRequest(`/user/${username}/perf/${perf}`);
      const perfStats = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(perfStats, null, 2)
        }]
      };
    }

    case "get_user_activity": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      try {
      const response = await lichessRequest(`/user/${username}/activity`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to get user activity: ${response.statusText}`);
        }
      const activity = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(activity, null, 2)
        }]
      };
      } catch (error: any) {
        throw new Error(`Failed to get user activity: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_users_by_id": {
      const ids = String(request.params.arguments?.ids);
      if (!ids) {
        throw new Error('IDs parameter is required');
      }
      if (ids.trim() === '') {
        throw new Error('IDs cannot be empty');
      }

      const idList = ids.split(',');
      if (idList.length > 300) {
        throw new Error('Maximum of 300 user IDs allowed');
      }

      try {
      const response = await lichessRequest('/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: ids
      });

      if (!response.ok) {
          throw new Error(`Failed to get users: ${response.statusText}`);
      }

        const users = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(users, null, 2)
        }]
      };
      } catch (error: any) {
        throw new Error(`Failed to get users: ${error.message || 'Unknown error'}`);
      }
    }

    case "unblock_user": {
      const username = String(request.params.arguments?.username);
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      try {
        const response = await lichessRequest(`/rel/unblock/${username}`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to unblock user: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully unblocked ${username}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to unblock user: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_game": {
      const gameId = String(request.params.arguments?.gameId);
      
      // Validate gameId
      if (!gameId || gameId.length !== 8) {
        throw new Error('Game ID must be exactly 8 characters long');
      }

      const params = new URLSearchParams();
      
      // Add optional parameters with proper validation
      const booleanParams = ['moves', 'pgnInJson', 'tags', 'clocks', 'evals', 'accuracy', 'opening', 'literate'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest(`/game/export/${gameId}?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          throw new Error(`Failed to export game: ${response.statusText}`);
        }

        // Check if response is PGN or JSON
        const contentType = response.headers.get('content-type');
        let content;
        
        if (contentType?.includes('application/x-chess-pgn')) {
          content = await response.text();
        } else {
          content = await response.json();
        }

        return {
          content: [{
            type: "text",
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export game: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_ongoing_game": {
      const username = String(request.params.arguments?.username);
      
      // Validate username
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      const params = new URLSearchParams();
      
      // Add optional parameters with proper validation
      const booleanParams = ['moves', 'pgnInJson', 'tags', 'clocks', 'evals', 'opening'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest(`/user/${username}/current-game?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found or has no ongoing game`);
          }
          throw new Error(`Failed to export ongoing game: ${response.statusText}`);
        }

        // Check if response is PGN or JSON
        const contentType = response.headers.get('content-type');
        let content;
        
        if (contentType?.includes('application/x-chess-pgn')) {
          content = await response.text();
        } else {
          content = await response.json();
        }

        return {
          content: [{
            type: "text",
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export ongoing game: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_user_games": {
      const username = String(request.params.arguments?.username);
      
      // Validate username
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      const params = new URLSearchParams();
      
      // Add timestamp parameters with validation
      if (request.params.arguments?.since !== undefined) {
        const since = Number(request.params.arguments.since);
        if (since < 1356998400070) {
          throw new Error('Since timestamp must be after January 1, 2013');
        }
        params.append('since', String(since));
      }
      
      if (request.params.arguments?.until !== undefined) {
        const until = Number(request.params.arguments.until);
        if (until < 1356998400070) {
          throw new Error('Until timestamp must be after January 1, 2013');
        }
        params.append('until', String(until));
      }
      
      if (request.params.arguments?.max !== undefined) {
        const max = Number(request.params.arguments.max);
        if (max < 1) {
          throw new Error('Max number of games must be at least 1');
        }
        params.append('max', String(max));
      }

      // Add string parameters
      const stringParams = ['vs', 'perfType', 'color', 'players', 'sort'] as const;
      for (const param of stringParams) {
        const value = String(request.params.arguments?.[param] || '');
        if (value) {
          // Validate enum values where applicable
          if (param === 'color' && !['white', 'black'].includes(value)) {
            throw new Error('Color must be either "white" or "black"');
          }
          if (param === 'sort' && !['dateAsc', 'dateDesc'].includes(value)) {
            throw new Error('Sort must be either "dateAsc" or "dateDesc"');
          }
          if (param === 'perfType') {
            const validPerfTypes = ['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence', 
                                  'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 
                                  'racingKings', 'threeCheck'];
            if (!validPerfTypes.includes(value)) {
              throw new Error('Invalid perfType value');
            }
          }
          params.append(param, value);
        }
      }

      // Add boolean parameters
      const booleanParams = ['rated', 'analysed', 'moves', 'tags', 'clocks', 'evals', 
                            'accuracy', 'opening', 'ongoing', 'finished', 'literate', 'lastFen'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest(`/games/user/${username}?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to export games: ${response.statusText}`);
        }

        // Check if response is PGN or NDJSON
        const contentType = response.headers.get('content-type');
        let content;
        
        if (contentType?.includes('application/x-chess-pgn')) {
          content = await response.text();
        } else if (contentType?.includes('application/x-ndjson')) {
          // For NDJSON, we need to handle the streaming format
        const text = await response.text();
          content = text.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
        } else {
          throw new Error('Unexpected response format');
        }

        return {
          content: [{
            type: "text",
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export games: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_games_by_ids": {
      const ids = String(request.params.arguments?.ids);
      
      // Validate IDs
      if (!ids) {
        throw new Error('Game IDs parameter is required');
      }
      
      const idList = ids.split(',');
      if (idList.length > 300) {
        throw new Error('Maximum of 300 game IDs allowed');
      }
      
      // Add optional parameters
      const params = new URLSearchParams();
      const booleanParams = ['moves', 'pgnInJson', 'tags', 'clocks', 'evals', 'opening'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest('/games/export/_ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: ids
        });

        if (!response.ok) {
          throw new Error(`Failed to export games: ${response.statusText}`);
        }

        // Check content type to determine format
        const contentType = response.headers.get('content-type');
        let content;

        if (contentType?.includes('application/x-chess-pgn')) {
          content = await response.text();
        } else if (contentType?.includes('application/x-ndjson')) {
          // For NDJSON, handle the streaming format
          const text = await response.text();
          content = text.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
        } else {
          // Default to JSON
          content = await response.json();
        }

        return {
          content: [{
            type: "text",
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export games: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_tv_channels": {
      try {
        const response = await lichessRequest('/tv/channels');
        
        if (!response.ok) {
          throw new Error(`Failed to get TV channels: ${response.statusText}`);
        }

        const channels = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(channels, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get TV channels: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_tv_game": {
      const channel = String(request.params.arguments?.channel || '');
      
      // Validate channel if provided
      const validChannels = [
        "bot",
        "blitz", 
        "racingKings",
        "ultraBullet",
        "bullet",
        "classical", 
        "threeCheck",
        "antichess",
        "computer",
        "horde",
        "rapid",
        "atomic",
        "crazyhouse",
        "chess960",
        "kingOfTheHill",
        "best"
      ];
      
      if (channel && !validChannels.includes(channel)) {
        throw new Error(`Invalid channel. Must be one of: ${validChannels.join(', ')}`);
      }

      try {
        const path = channel ? `/tv/${channel}` : '/tv';
        const response = await lichessRequest(path);
        
        if (!response.ok) {
          throw new Error(`Failed to get TV game: ${response.statusText}`);
        }

        // Get the content type to determine the format
        const contentType = response.headers.get('content-type');
        let content;

        if (contentType?.includes('application/x-chess-pgn')) {
          // Handle PGN format
          content = await response.text();
        } else {
          // Handle JSON format if available
          content = await response.json();
        }

        return {
          content: [{
            type: "text",
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get TV game: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_puzzle_activity": {
      const max = request.params.arguments?.max;
      
      // Validate max parameter if provided
      if (max !== undefined) {
        const maxNum = Number(max);
        if (isNaN(maxNum)) {
          throw new Error('max parameter must be a number');
        }
        if (maxNum < 1 || maxNum > 200) {
          throw new Error('max parameter must be between 1 and 200');
        }
      }

      const params = new URLSearchParams();
      if (max !== undefined) {
        params.append('max', String(max));
      }

      try {
        const response = await lichessRequest(`/puzzle/activity?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get puzzle activity: ${response.statusText}`);
        }

        const activity = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(activity, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get puzzle activity: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_puzzle_dashboard": {
      const days = Number(request.params.arguments?.days) || 30;
      
      // Validate days parameter
      if (isNaN(days)) {
        throw new Error('days parameter must be a number');
      }
      if (days < 1) {
        throw new Error('days parameter must be at least 1');
      }
      if (days > 30) {
        throw new Error('days parameter must not exceed 30');
      }

      try {
        const response = await lichessRequest(`/puzzle/dashboard/${days}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get puzzle dashboard: ${response.statusText}`);
        }

        const dashboard = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(dashboard, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get puzzle dashboard: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_puzzle_race": {
      const raceId = String(request.params.arguments?.raceId);
      
      // Validate raceId parameter
      if (!raceId) {
        throw new Error('raceId parameter is required');
      }
      if (raceId.trim() === '') {
        throw new Error('raceId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/racer/${raceId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Puzzle race ${raceId} not found`);
          }
          throw new Error(`Failed to get puzzle race: ${response.statusText}`);
        }

        const race = await response.json() as { id: string; url: string };
        
        // Validate response format
        if (!race.id || !race.url) {
          throw new Error('Invalid response format from Lichess API');
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(race, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get puzzle race: ${error.message || 'Unknown error'}`);
      }
    }

    case "create_puzzle_race": {
      try {
        const response = await lichessRequest('/racer', {
          method: 'POST'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create puzzle race: ${response.statusText}`);
        }

        const race = await response.json() as { id: string; url: string };
        
        // Validate response format
        if (!race.id || !race.url) {
          throw new Error('Invalid response format from Lichess API');
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(race, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create puzzle race: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_puzzle_storm_dashboard": {
      const days = Number(request.params.arguments?.days) || 30;
      
      // Validate days parameter
      if (isNaN(days)) {
        throw new Error('days parameter must be a number');
      }
      if (days < 1) {
        throw new Error('days parameter must be at least 1');
      }
      if (days > 30) {
        throw new Error('days parameter must not exceed 30');
      }

      try {
        const response = await lichessRequest(`/storm/dashboard/${days}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get puzzle storm dashboard: ${response.statusText}`);
        }

        const dashboard = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(dashboard, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get puzzle storm dashboard: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_team_info": {
      const teamId = String(request.params.arguments?.teamId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} not found`);
          }
          throw new Error(`Failed to get team info: ${response.statusText}`);
        }

        const team = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(team, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get team info: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_team_members": {
      const teamId = String(request.params.arguments?.teamId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      const max = Number(request.params.arguments?.max) || 100;
      
      // Validate max parameter
      if (isNaN(max)) {
        throw new Error('max parameter must be a number');
      }
      if (max < 1) {
        throw new Error('max parameter must be at least 1');
      }
      
      const params = new URLSearchParams();
      params.append('max', String(max));
      
      try {
        const response = await lichessRequest(`/team/${teamId}/users?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} not found`);
          }
          throw new Error(`Failed to get team members: ${response.statusText}`);
        }

        const members = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(members, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get team members: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_team_join_requests": {
      const teamId = String(request.params.arguments?.teamId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}/requests`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} not found`);
          }
          throw new Error(`Failed to get team join requests: ${response.statusText}`);
        }

        const requests = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(requests, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get team join requests: ${error.message || 'Unknown error'}`);
      }
    }

    case "join_team": {
      const teamId = String(request.params.arguments?.teamId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      // Get optional message parameter
      const message = String(request.params.arguments?.message || '');
      
      const params = new URLSearchParams();
      if (message.trim()) {
        params.append('message', message);
      }
      
      try {
        const response = await lichessRequest(`/team/${teamId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to join this team');
          }
          if (response.status === 409) {
            throw new Error('You are already a member of this team');
          }
          throw new Error(`Failed to join team: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully joined team ${teamId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to join team: ${error.message || 'Unknown error'}`);
      }
    }

    case "leave_team": {
      const teamId = String(request.params.arguments?.teamId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}/quit`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to leave this team');
          }
          if (response.status === 409) {
            throw new Error('You are not a member of this team');
          }
          throw new Error(`Failed to leave team: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully left team ${teamId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to leave team: ${error.message || 'Unknown error'}`);
      }
    }

    case "kick_user_from_team": {
      const teamId = String(request.params.arguments?.teamId);
      const userId = String(request.params.arguments?.userId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      // Validate userId parameter
      if (!userId) {
        throw new Error('userId parameter is required');
      }
      if (userId.trim() === '') {
        throw new Error('userId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}/kick/${userId}`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} or user ${userId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to kick users from this team');
          }
          if (response.status === 409) {
            throw new Error('User is not a member of this team');
          }
          throw new Error(`Failed to kick user from team: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully kicked user ${userId} from team ${teamId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to kick user from team: ${error.message || 'Unknown error'}`);
      }
    }

    case "accept_join_request": {
      const teamId = String(request.params.arguments?.teamId);
      const userId = String(request.params.arguments?.userId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      // Validate userId parameter
      if (!userId) {
        throw new Error('userId parameter is required');
      }
      if (userId.trim() === '') {
        throw new Error('userId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}/request/${userId}/accept`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} or join request from user ${userId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to accept join requests for this team');
          }
          throw new Error(`Failed to accept join request: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully accepted join request from user ${userId} to team ${teamId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to accept join request: ${error.message || 'Unknown error'}`);
      }
    }

    case "decline_join_request": {
      const teamId = String(request.params.arguments?.teamId);
      const userId = String(request.params.arguments?.userId);
      
      // Validate teamId parameter
      if (!teamId) {
        throw new Error('teamId parameter is required');
      }
      if (teamId.trim() === '') {
        throw new Error('teamId cannot be empty');
      }

      // Validate userId parameter
      if (!userId) {
        throw new Error('userId parameter is required');
      }
      if (userId.trim() === '') {
        throw new Error('userId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/team/${teamId}/request/${userId}/decline`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Team ${teamId} or join request from user ${userId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to decline join requests for this team');
          }
          throw new Error(`Failed to decline join request: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully declined join request from user ${userId} to team ${teamId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to decline join request: ${error.message || 'Unknown error'}`);
      }
    }

    case "search_teams": {
      const text = String(request.params.arguments?.text);
      const page = Number(request.params.arguments?.page) || 1;
      
      // Validate text parameter
      if (!text) {
        throw new Error('text parameter is required');
      }
      if (text.trim() === '') {
        throw new Error('text cannot be empty');
      }

      // Validate page parameter
      if (isNaN(page)) {
        throw new Error('page parameter must be a number');
      }
      if (page < 1) {
        throw new Error('page parameter must be at least 1');
      }

      try {
        const params = new URLSearchParams({
          text,
          page: String(page)
        });
        
        const response = await lichessRequest(`/team/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to search teams: ${response.statusText}`);
        }

        // The API returns a TeamPaginatorJson object
        const teams = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(teams, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to search teams: ${error.message || 'Unknown error'}`);
      }
    }

    case "make_board_move": {
      const gameId = String(request.params.arguments?.gameId);
      const move = String(request.params.arguments?.move);
      const offeringDraw = Boolean(request.params.arguments?.offeringDraw);

      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      // Validate move parameter
      if (!move) {
        throw new Error('move parameter is required');
      }
      if (move.trim() === '') {
        throw new Error('move cannot be empty');
      }

      try {
        const params = new URLSearchParams();
        if (offeringDraw) {
          params.append('offeringDraw', 'true');
        }

        const response = await lichessRequest(`/board/game/${gameId}/move/${move}?${params.toString()}`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Invalid move');
          }
          throw new Error(`Failed to make move: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Move ${move} made in game ${gameId}${offeringDraw ? ' with draw offer' : ''}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to make move: ${error.message || 'Unknown error'}`);
      }
    }

    case "abort_board_game": {
      const gameId = String(request.params.arguments?.gameId);
      
      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/board/game/${gameId}/abort`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Game cannot be aborted');
          }
          throw new Error(`Failed to abort game: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Game ${gameId} aborted`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to abort game: ${error.message || 'Unknown error'}`);
      }
    }

    case "resign_board_game": {
      const gameId = String(request.params.arguments?.gameId);
      
      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/board/game/${gameId}/resign`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Game cannot be resigned');
          }
          throw new Error(`Failed to resign game: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Resigned game ${gameId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to resign game: ${error.message || 'Unknown error'}`);
      }
    }

    case "write_in_chat": {
      const gameId = String(request.params.arguments?.gameId);
      const room = String(request.params.arguments?.room);
      const text = String(request.params.arguments?.text);

      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      // Validate room parameter
      if (!room) {
        throw new Error('room parameter is required');
      }
      if (!['player', 'spectator'].includes(room)) {
        throw new Error('room must be either "player" or "spectator"');
      }

      // Validate text parameter
      if (!text) {
        throw new Error('text parameter is required');
      }
      if (text.trim() === '') {
        throw new Error('text cannot be empty');
      }

      try {
        const response = await lichessRequest(`/board/game/${gameId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ room, text })
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Invalid chat message');
          }
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Message sent to ${room} chat in game ${gameId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
    }

    case "handle_draw_board_game": {
      const gameId = String(request.params.arguments?.gameId);
      const accept = Boolean(request.params.arguments?.accept ?? true);
      
      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/board/game/${gameId}/draw/${accept ? 'yes' : 'no'}`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('No draw offer to handle');
          }
          throw new Error(`Failed to handle draw offer: ${response.statusText}`);
        }
        
        return {
          content: [{
            type: "text",
            text: `Draw offer ${accept ? 'accepted' : 'declined'} for game ${gameId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to handle draw offer: ${error.message || 'Unknown error'}`);
      }
    }

    case "claim_victory": {
      const gameId = String(request.params.arguments?.gameId);
      
      // Validate gameId parameter
      if (!gameId) {
        throw new Error('gameId parameter is required');
      }
      if (gameId.trim() === '') {
        throw new Error('gameId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/board/game/${gameId}/claim-victory`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Game ${gameId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Victory cannot be claimed');
          }
          throw new Error(`Failed to claim victory: ${response.statusText}`);
        }
        
        return {
          content: [{
            type: "text",
            text: `Victory claimed for game ${gameId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to claim victory: ${error.message || 'Unknown error'}`);
      }
    }

    case "list_challenges": {
      try {
        const response = await lichessRequest('/challenge');
        
        if (!response.ok) {
          throw new Error(`Failed to list challenges: ${response.statusText}`);
        }

        // The API returns a list of challenges in JSON format
        const challenges = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(challenges, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to list challenges: ${error.message || 'Unknown error'}`);
      }
    }

    case "accept_challenge": {
      const challengeId = String(request.params.arguments?.challengeId);
      
      // Validate challengeId parameter
      if (!challengeId) {
        throw new Error('challengeId parameter is required');
      }
      if (challengeId.trim() === '') {
        throw new Error('challengeId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/challenge/${challengeId}/accept`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Challenge ${challengeId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Challenge cannot be accepted');
          }
          throw new Error(`Failed to accept challenge: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Challenge ${challengeId} accepted`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to accept challenge: ${error.message || 'Unknown error'}`);
      }
    }

    case "decline_challenge": {
      const challengeId = String(request.params.arguments?.challengeId);
      const reason = String(request.params.arguments?.reason || 'generic');

      // Validate challengeId parameter
      if (!challengeId) {
        throw new Error('challengeId parameter is required');
      }
      if (challengeId.trim() === '') {
        throw new Error('challengeId cannot be empty');
      }

      // Validate reason parameter
      const validReasons = ['generic', 'later', 'tooFast', 'tooSlow', 'timeControl', 'rated', 'casual', 'standard', 'variant', 'noBot', 'onlyBot'];
      if (!validReasons.includes(reason)) {
        throw new Error(`Invalid reason. Must be one of: ${validReasons.join(', ')}`);
      }

      try {
        const response = await lichessRequest(`/challenge/${challengeId}/decline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Challenge ${challengeId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Challenge cannot be declined');
          }
          throw new Error(`Failed to decline challenge: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Challenge ${challengeId} declined`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to decline challenge: ${error.message || 'Unknown error'}`);
      }
    }

    case "cancel_challenge": {
      const challengeId = String(request.params.arguments?.challengeId);
      
      // Validate challengeId parameter
      if (!challengeId) {
        throw new Error('challengeId parameter is required');
      }
      if (challengeId.trim() === '') {
        throw new Error('challengeId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/challenge/${challengeId}/cancel`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Challenge ${challengeId} not found`);
          }
          if (response.status === 400) {
            throw new Error('Challenge cannot be cancelled');
          }
          throw new Error(`Failed to cancel challenge: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Challenge ${challengeId} cancelled`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to cancel challenge: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_arena_tournaments": {
      try {
        const response = await lichessRequest('/tournament');
        
        if (!response.ok) {
          throw new Error(`Failed to get arena tournaments: ${response.statusText}`);
        }

        // The API returns a list of current tournaments
        const tournaments = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tournaments, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get arena tournaments: ${error.message || 'Unknown error'}`);
      }
    }

    case "create_arena": {
      // Validate required name parameter
      if (!request.params.arguments?.name) {
        throw new Error('name parameter is required');
      }

      try {
        const body: Record<string, any> = {
          name: String(request.params.arguments.name),
          clockTime: Number(request.params.arguments?.clockTime) || 3,
          clockIncrement: Number(request.params.arguments?.clockIncrement) || 2,
          minutes: Number(request.params.arguments?.minutes) || 45,
          waitMinutes: Number(request.params.arguments?.waitMinutes) || 5,
          variant: String(request.params.arguments?.variant || 'standard'),
          rated: Boolean(request.params.arguments?.rated ?? true),
          berserkable: Boolean(request.params.arguments?.berserkable ?? true),
          streakable: Boolean(request.params.arguments?.streakable ?? true),
          hasChat: Boolean(request.params.arguments?.hasChat ?? true)
        };

        // Validate numeric parameters
        if (body.clockTime < 0) {
          throw new Error('clockTime must be positive');
        }
        if (body.clockIncrement < 0) {
          throw new Error('clockIncrement must be positive');
        }
        if (body.minutes < 1) {
          throw new Error('minutes must be at least 1');
        }
        if (body.waitMinutes < 1) {
          throw new Error('waitMinutes must be at least 1');
        }

        // Validate variant
        const validVariants = ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'];
        if (!validVariants.includes(body.variant)) {
          throw new Error(`Invalid variant. Must be one of: ${validVariants.join(', ')}`);
        }

        // Add optional parameters
        if (request.params.arguments?.startDate) {
          const startDate = Number(request.params.arguments.startDate);
          if (isNaN(startDate)) {
            throw new Error('startDate must be a valid timestamp');
          }
          body.startDate = startDate;
        }
        if (request.params.arguments?.position) {
          body.position = String(request.params.arguments.position);
        }
        if (request.params.arguments?.description) {
          body.description = String(request.params.arguments.description);
        }
        if (request.params.arguments?.conditions) {
          body.conditions = request.params.arguments.conditions;
        }

        const response = await lichessRequest('/tournament', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          if (response.status === 400) {
            throw new Error('Invalid tournament parameters');
          }
          throw new Error(`Failed to create tournament: ${response.statusText}`);
        }

        const tournament = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tournament, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_arena_info": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      
      // Validate tournamentId parameter
      if (!tournamentId) {
        throw new Error('tournamentId parameter is required');
      }
      if (tournamentId.trim() === '') {
        throw new Error('tournamentId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/tournament/${tournamentId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Tournament ${tournamentId} not found`);
          }
          throw new Error(`Failed to get tournament info: ${response.statusText}`);
        }

        const info = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(info, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get tournament info: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_arena_games": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      const response = await lichessRequest(`/tournament/${tournamentId}/games`);
      const games = await response.json();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(games, null, 2)
        }]
      };
    }

    case "get_arena_results": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      
      // Validate tournamentId parameter
      if (!tournamentId) {
        throw new Error('tournamentId parameter is required');
      }
      if (tournamentId.trim() === '') {
        throw new Error('tournamentId cannot be empty');
      }

      try {
        // Add optional query parameters
        const queryParams = new URLSearchParams();
        if (request.params.arguments?.nb) {
          queryParams.append('nb', String(request.params.arguments.nb));
        }
        if (request.params.arguments?.sheet) {
          queryParams.append('sheet', String(request.params.arguments.sheet));
        }

        const url = `/tournament/${tournamentId}/results${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await lichessRequest(url);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Tournament ${tournamentId} not found`);
          }
          throw new Error(`Failed to get tournament results: ${response.statusText}`);
        }

        const results = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get tournament results: ${error.message || 'Unknown error'}`);
      }
    }

    case "join_arena": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      
      // Validate tournamentId parameter
      if (!tournamentId) {
        throw new Error('tournamentId parameter is required');
      }
      if (tournamentId.trim() === '') {
        throw new Error('tournamentId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/tournament/${tournamentId}/join`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Tournament ${tournamentId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to join this tournament');
          }
          if (response.status === 400) {
            throw new Error('Cannot join this tournament');
          }
          throw new Error(`Failed to join tournament: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully joined tournament ${tournamentId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to join tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "withdraw_from_arena": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      
      // Validate tournamentId parameter
      if (!tournamentId) {
        throw new Error('tournamentId parameter is required');
      }
      if (tournamentId.trim() === '') {
        throw new Error('tournamentId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/tournament/${tournamentId}/withdraw`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Tournament ${tournamentId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to withdraw from this tournament');
          }
          if (response.status === 400) {
            throw new Error('Cannot withdraw from this tournament');
          }
          throw new Error(`Failed to withdraw from tournament: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully withdrew from tournament ${tournamentId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to withdraw from tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_team_battle_results": {
      const tournamentId = String(request.params.arguments?.tournamentId);
      
      // Validate tournamentId parameter
      if (!tournamentId) {
        throw new Error('tournamentId parameter is required');
      }
      if (tournamentId.trim() === '') {
        throw new Error('tournamentId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/tournament/${tournamentId}/teams`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Tournament ${tournamentId} not found`);
          }
          throw new Error(`Failed to get team battle results: ${response.statusText}`);
        }

        const results = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get team battle results: ${error.message || 'Unknown error'}`);
      }
    }

    case "create_swiss": {
      // Validate required parameters
      if (!request.params.arguments?.name) {
        throw new Error('name parameter is required');
      }
      if (!request.params.arguments?.teamId) {
        throw new Error('teamId parameter is required');
      }

      const clock = request.params.arguments?.clock as { limit?: number; increment?: number } | undefined;
      if (!clock) {
        throw new Error('clock parameter is required');
      }
      if (!clock.limit || !clock.increment) {
        throw new Error('clock must specify both limit and increment');
      }

      try {
        const body: Record<string, any> = {
          name: String(request.params.arguments.name),
          teamId: String(request.params.arguments.teamId),
          clock: {
            limit: Number(clock.limit),
            increment: Number(clock.increment)
          },
          nbRounds: Number(request.params.arguments?.nbRounds) || 7,
          variant: String(request.params.arguments?.variant || 'standard'),
          rated: Boolean(request.params.arguments?.rated ?? true),
          roundInterval: Number(request.params.arguments?.roundInterval) || 300
        };

        // Validate numeric parameters
        if (body.nbRounds < 1) {
          throw new Error('nbRounds must be at least 1');
        }
        if (body.roundInterval < 1) {
          throw new Error('roundInterval must be at least 1 second');
        }
        if (body.clock.limit < 0) {
          throw new Error('clock limit must be positive');
        }
        if (body.clock.increment < 0) {
          throw new Error('clock increment must be positive');
        }

        // Validate variant
        const validVariants = ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'];
        if (!validVariants.includes(body.variant)) {
          throw new Error(`Invalid variant. Must be one of: ${validVariants.join(', ')}`);
        }

        // Add optional description
        if (request.params.arguments?.description) {
          body.description = String(request.params.arguments.description);
        }

        const response = await lichessRequest('/swiss/new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Team not found');
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to create tournaments for this team');
          }
          throw new Error(`Failed to create Swiss tournament: ${response.statusText}`);
        }

        const tournament = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tournament, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create Swiss tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_swiss_info": {
      const swissId = String(request.params.arguments?.swissId);
      
      // Validate swissId parameter
      if (!swissId) {
        throw new Error('swissId parameter is required');
      }
      if (swissId.trim() === '') {
        throw new Error('swissId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/swiss/${swissId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Swiss tournament ${swissId} not found`);
          }
          throw new Error(`Failed to get Swiss tournament info: ${response.statusText}`);
        }

        const info = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(info, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get Swiss tournament info: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_swiss_games": {
      const swissId = String(request.params.arguments?.swissId);
      
      // Validate swissId parameter
      if (!swissId) {
        throw new Error('swissId parameter is required');
      }
      if (swissId.trim() === '') {
        throw new Error('swissId cannot be empty');
      }

      try {
        // Build query parameters
        const params = new URLSearchParams();
        
        // Add optional parameters if provided
        if (request.params.arguments?.player) {
          params.append('player', String(request.params.arguments.player));
        }
        
        const booleanParams = ['moves', 'pgnInJson', 'tags', 'clocks', 'evals', 'opening'];
        for (const param of booleanParams) {
          if (request.params.arguments?.[param] !== undefined) {
            params.append(param, String(request.params.arguments[param]));
          }
        }

        const response = await lichessRequest(`/swiss/${swissId}/games?${params.toString()}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Swiss tournament ${swissId} not found`);
          }
          throw new Error(`Failed to get Swiss tournament games: ${response.statusText}`);
        }

        // Read the response as text since it may be NDJSON format
        const text = await response.text();
        
        // Split by newlines and parse each line as JSON
        const games = text
          .split('\n')
          .filter(line => line.trim()) // Remove empty lines
          .map(line => JSON.parse(line));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(games, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get Swiss tournament games: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_swiss_results": {
      const swissId = String(request.params.arguments?.swissId);
      
      // Validate swissId parameter
      if (!swissId) {
        throw new Error('swissId parameter is required');
      }
      if (swissId.trim() === '') {
        throw new Error('swissId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/swiss/${swissId}/results`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Swiss tournament ${swissId} not found`);
          }
          throw new Error(`Failed to get Swiss tournament results: ${response.statusText}`);
        }

        // Read the response as text and handle NDJSON format
        const text = await response.text();
        
        // Split by newlines and parse each line as JSON
        const results = text
          .split('\n')
          .filter(line => line.trim()) // Remove empty lines
          .map(line => JSON.parse(line));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get Swiss tournament results: ${error.message || 'Unknown error'}`);
      }
    }

    case "join_swiss": {
      const swissId = String(request.params.arguments?.swissId);
      
      // Validate swissId parameter
      if (!swissId) {
        throw new Error('swissId parameter is required');
      }
      if (swissId.trim() === '') {
        throw new Error('swissId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/swiss/${swissId}/join`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Swiss tournament ${swissId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to join this tournament');
          }
          if (response.status === 400) {
            throw new Error('Cannot join this tournament');
          }
          throw new Error(`Failed to join Swiss tournament: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully joined Swiss tournament ${swissId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to join Swiss tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "withdraw_from_swiss": {
      const swissId = String(request.params.arguments?.swissId);
      
      // Validate swissId parameter
      if (!swissId) {
        throw new Error('swissId parameter is required');
      }
      if (swissId.trim() === '') {
        throw new Error('swissId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/swiss/${swissId}/withdraw`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Swiss tournament ${swissId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to withdraw from this tournament');
          }
          if (response.status === 400) {
            throw new Error('Cannot withdraw from this tournament');
          }
          throw new Error(`Failed to withdraw from Swiss tournament: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully withdrew from Swiss tournament ${swissId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to withdraw from Swiss tournament: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_current_simuls": {
      try {
        const response = await lichessRequest('/simul');

        if (!response.ok) {
          throw new Error(`Failed to get current simuls: ${response.statusText}`);
        }

        const simuls = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(simuls, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get current simuls: ${error.message || 'Unknown error'}`);
      }
    }

    case "create_simul": {
      // Validate required name parameter
      if (!request.params.arguments?.name) {
        throw new Error('name parameter is required');
      }

      try {
        const body: Record<string, any> = {
          name: String(request.params.arguments.name),
          variant: String(request.params.arguments?.variant || 'standard'),
          clockTime: Number(request.params.arguments?.clockTime) || 5,
          clockIncrement: Number(request.params.arguments?.clockIncrement) || 3,
          color: String(request.params.arguments?.color || 'white')
        };

        // Validate numeric parameters
        if (body.clockTime < 0) {
          throw new Error('clockTime must be positive');
        }
        if (body.clockIncrement < 0) {
          throw new Error('clockIncrement must be positive');
        }

        // Validate variant
        const validVariants = ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'];
        if (!validVariants.includes(body.variant)) {
          throw new Error(`Invalid variant. Must be one of: ${validVariants.join(', ')}`);
        }

        // Validate color
        if (!['white', 'black'].includes(body.color)) {
          throw new Error('color must be either "white" or "black"');
        }

        // Add optional parameters
        if (request.params.arguments?.minRating) {
          body.minRating = Number(request.params.arguments.minRating);
        }
        if (request.params.arguments?.maxRating) {
          body.maxRating = Number(request.params.arguments.maxRating);
        }
        if (request.params.arguments?.text) {
          body.text = String(request.params.arguments.text);
        }

        const response = await lichessRequest('/simul/new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('You are not allowed to create simuls');
          }
          throw new Error(`Failed to create simul: ${response.statusText}`);
        }

        const simul = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(simul, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create simul: ${error.message || 'Unknown error'}`);
      }
    }

    case "join_simul": {
      const simulId = String(request.params.arguments?.simulId);
      
      // Validate simulId parameter
      if (!simulId) {
        throw new Error('simulId parameter is required');
      }
      if (simulId.trim() === '') {
        throw new Error('simulId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/simul/${simulId}/join`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Simul ${simulId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to join this simul');
          }
          if (response.status === 400) {
            throw new Error('Cannot join this simul');
          }
          throw new Error(`Failed to join simul: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully joined simul ${simulId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to join simul: ${error.message || 'Unknown error'}`);
      }
    }

    case "withdraw_from_simul": {
      const simulId = String(request.params.arguments?.simulId);
      
      // Validate simulId parameter
      if (!simulId) {
        throw new Error('simulId parameter is required');
      }
      if (simulId.trim() === '') {
        throw new Error('simulId cannot be empty');
      }

      try {
        const response = await lichessRequest(`/simul/${simulId}/withdraw`, {
          method: 'POST'
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Simul ${simulId} not found`);
          }
          if (response.status === 403) {
            throw new Error('You are not allowed to withdraw from this simul');
          }
          if (response.status === 400) {
            throw new Error('Cannot withdraw from this simul');
          }
          throw new Error(`Failed to withdraw from simul: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully withdrew from simul ${simulId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to withdraw from simul: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_study_chapter": {
      const studyId = String(request.params.arguments?.studyId);
      const chapterId = String(request.params.arguments?.chapterId);
      
      // Validate IDs
      if (!studyId || studyId.length !== 8) {
        throw new Error('Study ID must be exactly 8 characters long');
      }
      if (!chapterId || chapterId.length !== 8) {
        throw new Error('Chapter ID must be exactly 8 characters long');
      }

      // Build query parameters
      const params = new URLSearchParams();
      const booleanParams = ['clocks', 'comments', 'variations', 'source', 'orientation'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest(`/study/${studyId}/${chapterId}.pgn?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Study chapter not found`);
          }
          throw new Error(`Failed to export study chapter: ${response.statusText}`);
        }

        const pgn = await response.text();
        return {
          content: [{
            type: "text",
            text: pgn
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export study chapter: ${error.message || 'Unknown error'}`);
      }
    }

    case "export_all_study_chapters": {
      const studyId = String(request.params.arguments?.studyId);
      
      // Validate studyId
      if (!studyId || studyId.length !== 8) {
        throw new Error('Study ID must be exactly 8 characters long');
      }

      // Build query parameters
      const params = new URLSearchParams();
      const booleanParams = ['clocks', 'comments', 'variations', 'source', 'orientation'];
      for (const param of booleanParams) {
        if (request.params.arguments?.[param] !== undefined) {
          params.append(param, String(request.params.arguments[param]));
        }
      }

      try {
        const response = await lichessRequest(`/study/${studyId}.pgn?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Study not found`);
          }
          throw new Error(`Failed to export study chapters: ${response.statusText}`);
        }

        const pgn = await response.text();
        return {
          content: [{
            type: "text",
            text: pgn
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to export study chapters: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_user_studies": {
      const username = String(request.params.arguments?.username);
      
      // Validate username
      if (!username) {
        throw new Error('Username parameter is required');
      }
      if (username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      try {
        const response = await lichessRequest(`/study/by/${username}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`User ${username} not found`);
          }
          throw new Error(`Failed to get user studies: ${response.statusText}`);
        }

        // Read the response as text and handle NDJSON format
        const text = await response.text();
        
        // Split by newlines and parse each line as JSON
        const studies = text
          .split('\n')
          .filter(line => line.trim()) // Remove empty lines
          .map(line => JSON.parse(line));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(studies, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get user studies: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_thread": {
      const userId = String(request.params.arguments?.userId);
      
      // Validate userId
      if (!userId) {
        throw new Error('User ID parameter is required');
      }
      if (userId.trim() === '') {
        throw new Error('User ID cannot be empty');
      }

      try {
        const response = await lichessRequest(`/inbox/${userId}`);
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Missing authorization or insufficient permissions');
          }
          if (response.status === 404) {
            throw new Error(`Thread with user ${userId} not found`);
          }
          throw new Error(`Failed to get thread: ${response.statusText}`);
        }

        const thread = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(thread, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get thread: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_official_broadcasts": {
      try {
        const response = await lichessRequest('/broadcast');
        
        if (!response.ok) {
          throw new Error(`Failed to get official broadcasts: ${response.statusText}`);
        }

        // Read the response as text
        const text = await response.text();
        
        // Split by newlines and parse each line as JSON
        const broadcasts = text
          .split('\n')
          .filter(line => line.trim()) // Remove empty lines
          .map(line => JSON.parse(line));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(broadcasts, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get official broadcasts: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_broadcast": {
      const broadcastId = String(request.params.arguments?.broadcastId);
      
      // Validate broadcastId
      if (!broadcastId) {
        throw new Error('Broadcast ID parameter is required');
      }
      if (broadcastId.trim() === '') {
        throw new Error('Broadcast ID cannot be empty');
      }

      try {
        const response = await lichessRequest(`/broadcast/${broadcastId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Broadcast ${broadcastId} not found`);
          }
          throw new Error(`Failed to get broadcast: ${response.statusText}`);
        }

        const broadcast = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(broadcast, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get broadcast: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_broadcast_round": {
      const broadcastId = String(request.params.arguments?.broadcastId);
      const roundId = String(request.params.arguments?.roundId);
      
      // Validate IDs
      if (!broadcastId) {
        throw new Error('Broadcast ID parameter is required');
      }
      if (broadcastId.trim() === '') {
        throw new Error('Broadcast ID cannot be empty');
      }
      if (!roundId) {
        throw new Error('Round ID parameter is required');
      }
      if (roundId.trim() === '') {
        throw new Error('Round ID cannot be empty');
      }

      try {
        const response = await lichessRequest(`/broadcast/${broadcastId}/${roundId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Broadcast round not found`);
          }
          throw new Error(`Failed to get broadcast round: ${response.statusText}`);
        }

        const round = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(round, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get broadcast round: ${error.message || 'Unknown error'}`);
      }
    }

    case "push_broadcast_round_pgn": {
      const broadcastId = String(request.params.arguments?.broadcastId);
      const roundId = String(request.params.arguments?.roundId);
      const pgn = String(request.params.arguments?.pgn);

      // Validate parameters
      if (!broadcastId) {
        throw new Error('Broadcast ID parameter is required');
      }
      if (broadcastId.trim() === '') {
        throw new Error('Broadcast ID cannot be empty');
      }
      if (!roundId) {
        throw new Error('Round ID parameter is required');
      }
      if (roundId.trim() === '') {
        throw new Error('Round ID cannot be empty');
      }
      if (!pgn) {
        throw new Error('PGN parameter is required');
      }
      if (pgn.trim() === '') {
        throw new Error('PGN cannot be empty');
      }

      try {
        const response = await lichessRequest(`/broadcast/${broadcastId}/${roundId}/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: pgn
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Broadcast round not found`);
          }
          if (response.status === 401) {
            throw new Error('Missing authorization or insufficient permissions');
          }
          throw new Error(`Failed to push PGN: ${response.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully pushed PGN to broadcast ${broadcastId} round ${roundId}`
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to push PGN: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_cloud_eval": {
      const fen = String(request.params.arguments?.fen);
      const multiPv = Number(request.params.arguments?.multiPv) || 1;
      
      // Validate fen parameter
      if (!fen) {
        throw new Error('FEN parameter is required');
      }
      if (fen.trim() === '') {
        throw new Error('FEN cannot be empty');
      }

      // Validate multiPv parameter
      if (isNaN(multiPv)) {
        throw new Error('multiPv must be a number');
      }
      if (multiPv < 1 || multiPv > 5) {
        throw new Error('multiPv must be between 1 and 5');
      }

      try {
        const params = new URLSearchParams({
          fen,
          multiPv: String(multiPv)
        });
        
        const response = await lichessRequest(`/cloud-eval?${params.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Position not found in cloud database');
          }
          throw new Error(`Failed to get cloud evaluation: ${response.statusText}`);
        }

        const evaluation = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(evaluation, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get cloud evaluation: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_fide_player": {
      const playerId = String(request.params.arguments?.playerId);  // Changed from username
      
      // Validate playerId parameter
      if (!playerId) {
        throw new Error('FIDE player ID parameter is required');
      }
      if (playerId.trim() === '') {
        throw new Error('FIDE player ID cannot be empty');
      }

      try {
        const response = await lichessRequest(`/fide/player/${playerId}`);  // Changed endpoint path
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`FIDE player ${playerId} not found`);
          }
          throw new Error(`Failed to get FIDE player info: ${response.statusText}`);
        }

        const profile = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(profile, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get FIDE player info: ${error.message || 'Unknown error'}`);
      }
    }

    case "search_fide_players": {
      const name = String(request.params.arguments?.name);
      
      // Validate name parameter
      if (!name) {
        throw new Error('Name parameter is required');
      }
      if (name.trim() === '') {
        throw new Error('Name cannot be empty');
      }

      try {
        // The correct endpoint is /api/fide/player with query parameter 'q'
        const response = await lichessRequest(`/fide/player?q=${encodeURIComponent(name)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to search FIDE players: ${response.statusText}`);
        }

        const results = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to search FIDE players: ${error.message || 'Unknown error'}`);
      }
    }

    case "get_ongoing_games": {
      try {
        const nb = Number(request.params.arguments?.nb) || 9;
        
        // Validate nb parameter
        if (isNaN(nb) || nb < 1 || nb > 50) {
          throw new Error('nb parameter must be between 1 and 50');
        }

        const response = await lichessRequest(`/account/playing?nb=${nb}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get ongoing games: ${response.statusText}`);
        }

        const games = await response.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(games, null, 2)
          }]
        };
      } catch (error: any) {
        throw new Error(`Failed to get ongoing games: ${error.message || 'Unknown error'}`);
      }
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze_position",
        description: "Analyze the current position of a game",
      }
    ]
  };
});

/**
 * Handler for the analyze_position prompt
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "analyze_position") {
    throw new Error("Unknown prompt");
  }

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please analyze the current chess position and suggest the best moves for both sides. Consider:\n" +
                "1. Material balance\n" +
                "2. Piece activity\n" +
                "3. King safety\n" +
                "4. Pawn structure\n" +
                "5. Tactical opportunities"
        }
      }
    ]
  };
});

/**
 * Start the server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
