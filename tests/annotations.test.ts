import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { allTools } from "../src/tools/index.js";
import { buildServer } from "../src/server.js";
import { makeContext } from "./helpers/mock.js";

/**
 * Tools that delete or overwrite existing data, end or forfeit a game or event,
 * remove a person or relationship, or cannot be undone. MCP clients may use
 * `destructiveHint` to ask for confirmation, so this list is the safety review.
 */
const DESTRUCTIVE = [
  // account
  "set_token", "set_kid_mode", "revoke_token", "upgrade_to_bot",
  // board & bot games
  "abort_board_game", "resign_board_game", "claim_victory", "claim_draw_board_game",
  "handle_draw_board_game", "handle_takeback_board_game", "berserk_board_game",
  "abort_bot_game", "resign_bot_game", "claim_bot_victory", "claim_bot_draw",
  "handle_bot_draw", "handle_bot_takeback",
  // challenges
  "decline_challenge", "cancel_challenge",
  // tournaments, simuls, broadcasts
  "update_arena", "update_team_battle", "terminate_arena", "withdraw_from_arena",
  "update_swiss", "schedule_next_swiss_round", "terminate_swiss", "withdraw_from_swiss",
  "withdraw_from_simul",
  "update_broadcast_tournament", "update_broadcast_round", "reset_broadcast_round",
  "push_broadcast_round_pgn",
  // bulk pairings, engines, studies
  "delete_bulk_pairing", "update_external_engine", "delete_external_engine",
  "update_study_chapter_tags", "delete_study_chapter",
  // relations & teams
  "unfollow_user", "block_user", "leave_team", "kick_user_from_team", "decline_join_request",
];

/** Tools that change state on Lichess but only add to it (create, join, send, move). */
const ADDITIVE = [
  "add_user_note", "submit_puzzle_batch", "solve_puzzle_batch", "create_puzzle_race",
  "create_arena", "join_arena",
  "make_board_move", "make_move", "write_in_chat", "create_seek",
  "make_bot_move", "write_bot_chat",
  "create_broadcast_tournament", "create_broadcast_round",
  "create_bulk_pairing", "start_bulk_pairing_clocks",
  "create_challenge", "accept_challenge", "challenge_ai", "create_open_challenge",
  "start_challenge_clocks", "add_time_to_game", "admin_challenge_tokens",
  "create_external_engine", "analyse_with_external_engine",
  "acquire_external_engine_work", "submit_external_engine_work",
  "import_game", "send_message",
  "follow_user", "unblock_user",
  "create_simul", "join_simul",
  "create_study", "import_study_pgn", "add_study_chapter_moves",
  "create_swiss", "join_swiss",
  "join_team", "accept_join_request", "pm_all_team_members",
];

/** Tools that touch nothing outside this server process. */
const LOCAL_ONLY = ["set_token"];

describe("tool annotations", () => {
  it("every tool declares readOnlyHint explicitly", () => {
    for (const t of allTools) {
      expect(typeof t.annotations?.readOnlyHint, `${t.name} must declare readOnlyHint`).toBe(
        "boolean",
      );
    }
  });

  it("every write tool declares destructiveHint explicitly", () => {
    for (const t of allTools.filter((t) => t.annotations?.readOnlyHint === false)) {
      expect(typeof t.annotations?.destructiveHint, `${t.name} must declare destructiveHint`).toBe(
        "boolean",
      );
    }
  });

  it("marks exactly the reviewed set of tools as destructive", () => {
    const actual = allTools
      .filter((t) => t.annotations?.readOnlyHint === false && t.annotations.destructiveHint === true)
      .map((t) => t.name)
      .sort();
    expect(actual).toEqual([...DESTRUCTIVE].sort());
  });

  it("marks exactly the reviewed set of tools as additive writes", () => {
    const actual = allTools
      .filter((t) => t.annotations?.readOnlyHint === false && t.annotations.destructiveHint === false)
      .map((t) => t.name)
      .sort();
    expect(actual).toEqual([...ADDITIVE].sort());
  });

  it("marks every other tool read-only", () => {
    const writes = new Set([...DESTRUCTIVE, ...ADDITIVE]);
    for (const t of allTools.filter((t) => !writes.has(t.name))) {
      expect(t.annotations?.readOnlyHint, `${t.name} should be read-only`).toBe(true);
    }
  });

  it("marks only local tools as closed-world", () => {
    const closed = allTools.filter((t) => t.annotations?.openWorldHint === false).map((t) => t.name);
    expect(closed.sort()).toEqual([...LOCAL_ONLY].sort());
  });

  it("exposes annotations to MCP clients for plain and app tools", async () => {
    const server = buildServer(makeContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));

    expect(byName.get("upgrade_to_bot")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(byName.get("send_message")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    // Registered through registerAppTool rather than registerTool.
    expect(byName.get("play_puzzle")?.annotations).toMatchObject({ readOnlyHint: true });

    await client.close();
  });
});
