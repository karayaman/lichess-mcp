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

/**
 * Resolves a LICHESS_TOOLSETS value such as "core,arena,swiss" to tools.
 * Unset or empty means "core"; "all" means every toolset.
 */
export function selectTools(spec: string | undefined): AnyToolDefinition[] {
  const requested = (spec ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) requested.push("core");

  const selected = new Set<string>();
  for (const name of requested) {
    if (name === "all") Object.keys(TOOLSETS).forEach((k) => selected.add(k));
    else if (name === "core") CORE_TOOLSETS.forEach((k) => selected.add(k));
    else if (name in TOOLSETS) selected.add(name);
    else {
      throw new Error(
        `Unknown toolset "${name}" in LICHESS_TOOLSETS. ` +
          `Valid: core, all, ${Object.keys(TOOLSETS).join(", ")}.`,
      );
    }
  }
  return Object.entries(TOOLSETS)
    .filter(([k]) => selected.has(k))
    .flatMap(([, tools]) => tools);
}
