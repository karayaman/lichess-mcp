import { AnyToolDefinition } from "../registry.js";
import { accountTools } from "./account.js";
import { appTools } from "./apps/index.js";
import { analysisTools } from "./analysis.js";
import { arenaTools } from "./arena.js";
import { boardTools } from "./board.js";
import { botTools } from "./bot.js";
import { bulkPairingsTools } from "./bulk-pairings.js";
import { engineTools } from "./engine.js";
import { openingExplorerTools } from "./opening-explorer.js";
import { tablebaseTools } from "./tablebase.js";
import { broadcastsTools } from "./broadcasts.js";
import { challengesTools } from "./challenges.js";
import { gamesTools } from "./games.js";
import { messagingTools } from "./messaging.js";
import { puzzlesTools } from "./puzzles.js";
import { relationsTools } from "./relations.js";
import { simulTools } from "./simuls.js";
import { studiesTools } from "./studies.js";
import { swissTools } from "./swiss.js";
import { teamsTools } from "./teams.js";
import { tvTools } from "./tv.js";
import { usersTools } from "./users.js";

/**
 * Tools grouped by Lichess area. The server registers only the toolsets named
 * in LICHESS_TOOLSETS, because every registered tool's definition is sent to
 * the model each session.
 */
export const TOOLSETS: Record<string, AnyToolDefinition[]> = {
  account: accountTools,
  users: usersTools,
  relations: relationsTools,
  messaging: messagingTools,
  games: gamesTools,
  board: boardTools,
  bot: botTools,
  "bulk-pairings": bulkPairingsTools,
  engine: engineTools,
  "opening-explorer": openingExplorerTools,
  tablebase: tablebaseTools,
  challenges: challengesTools,
  arena: arenaTools,
  swiss: swissTools,
  simuls: simulTools,
  teams: teamsTools,
  studies: studiesTools,
  broadcasts: broadcastsTools,
  puzzles: puzzlesTools,
  tv: tvTools,
  analysis: analysisTools,
  apps: appTools,
};

/** Enabled when LICHESS_TOOLSETS is unset: looking up, reviewing and studying games. */
export const CORE_TOOLSETS = [
  "account",
  "users",
  "relations",
  "messaging",
  "games",
  "opening-explorer",
  "tablebase",
  "puzzles",
  "tv",
  "analysis",
  "apps",
] as const;

/** Every tool, in every toolset. */
export const allTools: AnyToolDefinition[] = Object.values(TOOLSETS).flat();

/** One line per toolset, shown to the model so it can turn on what a request needs. */
export const TOOLSET_DESCRIPTIONS: Record<string, string> = {
  account: "Your profile, email, preferences, kid mode, timeline, token checks, user notes, bot upgrade",
  users: "Player profiles, ratings, rating history, activity, leaderboards, crosstables, streamers",
  relations: "Follow, unfollow, block and unblock players",
  messaging: "Send private messages and read a conversation",
  games: "Export, import and list games; ongoing games; game chat; bookmarks",
  board: "Play your own games move by move: seeks, moves, draws, takebacks, resigning, chat",
  bot: "Play as a bot account: stream games, move, chat, draws, takebacks",
  "bulk-pairings": "Create and manage bulk pairings of many games at once",
  engine: "Register external engines and run analysis on them",
  "opening-explorer": "Opening statistics from masters, Lichess and individual players",
  tablebase: "Endgame tablebase lookups for standard, atomic and antichess",
  challenges: "Challenge players or the AI; accept, decline and cancel challenges; open challenges",
  arena: "Arena tournaments and team battles: find, join, create, edit, results",
  swiss: "Swiss tournaments: join, create, edit, schedule rounds, results",
  simuls: "Simultaneous exhibitions: list, create, join",
  teams: "Teams: search, join, leave, members, join requests, team tournaments, messaging members",
  studies: "Studies: export, create, import PGN, edit chapters",
  broadcasts: "Broadcasts of over-the-board events: browse, create, edit rounds, push PGN",
  puzzles: "Puzzles: daily, by id, batches, activity, dashboards, Puzzle Racer and Storm",
  tv: "Lichess TV channels and live feeds",
  analysis: "Cloud evaluations and FIDE player lookups",
  apps: "Interactive boards: play puzzles, step through games, explore openings",
};

/**
 * Expands toolset names, including "core" and "all", into toolset keys.
 * Throws on an unknown name, listing the valid ones.
 */
export function resolveToolsets(requested: string[]): string[] {
  const selected = new Set<string>();
  for (const raw of requested) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (name === "all") Object.keys(TOOLSETS).forEach((k) => selected.add(k));
    else if (name === "core") CORE_TOOLSETS.forEach((k) => selected.add(k));
    else if (name in TOOLSETS) selected.add(name);
    else {
      throw new Error(
        `Unknown toolset "${name}". Valid: core, all, ${Object.keys(TOOLSETS).join(", ")}.`,
      );
    }
  }
  return Object.keys(TOOLSETS).filter((k) => selected.has(k));
}

/**
 * Resolves a LICHESS_TOOLSETS value such as "core,arena,swiss" to tools.
 * Unset or empty means "core"; "all" means every toolset.
 */
export function selectTools(spec: string | undefined): AnyToolDefinition[] {
  const requested = (spec ?? "").split(",").filter((s) => s.trim());
  let keys: string[];
  try {
    keys = resolveToolsets(requested.length ? requested : ["core"]);
  } catch (error) {
    throw new Error(`LICHESS_TOOLSETS: ${(error as Error).message}`);
  }
  return keys.flatMap((k) => TOOLSETS[k]);
}
