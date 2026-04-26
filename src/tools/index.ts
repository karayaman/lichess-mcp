import { AnyToolDefinition } from "../registry.js";
import { accountTools } from "./account.js";
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
 * Aggregated tool registry. Each domain module exports an array of tools;
 * we concatenate them here so server.ts has a single source of truth.
 */
export const allTools: AnyToolDefinition[] = [
  ...accountTools,
  ...usersTools,
  ...relationsTools,
  ...messagingTools,
  ...gamesTools,
  ...boardTools,
  ...botTools,
  ...bulkPairingsTools,
  ...engineTools,
  ...openingExplorerTools,
  ...tablebaseTools,
  ...challengesTools,
  ...arenaTools,
  ...swissTools,
  ...simulTools,
  ...teamsTools,
  ...studiesTools,
  ...broadcastsTools,
  ...puzzlesTools,
  ...tvTools,
  ...analysisTools,
];
