import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import type { Color, Dests, Key } from "chessground/types";
import { Chess } from "chess.js";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

export type { Color, Dests, Key };

export function legalDestsFor(fen: string): Dests {
  const chess = new Chess(fen);
  const dests: Dests = new Map();
  for (const m of chess.moves({ verbose: true }) as Array<{ from: Key; to: Key }>) {
    const list = dests.get(m.from) ?? [];
    list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

export function turnColor(fen: string): Color {
  // FEN side-to-move is the field after the position: "w" or "b".
  return fen.split(" ")[1] === "w" ? "white" : "black";
}

export function makeBoard(el: HTMLElement, override: Config = {}): Api {
  const defaults: Config = {
    coordinates: true,
    coordinatesOnSquares: false,
    animation: { enabled: true, duration: 200 },
    highlight: { lastMove: true, check: true },
    drawable: { enabled: true, visible: true },
    movable: { free: false, showDests: true, color: undefined },
    premovable: { enabled: false },
    draggable: { showGhost: true },
  };
  return Chessground(el, { ...defaults, ...override });
}

/**
 * Convert a chess.js verbose move to UCI form (e2e4, e7e8q).
 */
export function toUci(from: Key, to: Key, promotion?: string): string {
  return promotion ? `${from}${to}${promotion}` : `${from}${to}`;
}

/**
 * Apply a UCI move on top of `fen`. Returns the resulting FEN, or null if
 * the move was illegal.
 */
export function applyUci(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2) as Key;
  const to = uci.slice(2, 4) as Key;
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  const move = chess.move({ from, to, promotion });
  return move ? chess.fen() : null;
}
