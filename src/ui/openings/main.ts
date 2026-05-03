import "../shared/theme.css";
import { Chess } from "chess.js";
import { bootstrap, extractUiProps } from "../shared/app-bootstrap.js";
import {
  applyUci,
  legalDestsFor,
  makeBoard,
  toUci,
  turnColor,
} from "../shared/board.js";
import type { Color, Key } from "../shared/board.js";
import type {
  ExplorerData,
  ExplorerMove,
  ExplorerSource,
  OpeningsProps,
} from "../../types/ui-props.js";

const root = document.getElementById("board")!;
const titleEl = document.getElementById("title")!;
const metaEl = document.getElementById("meta")!;
const statusEl = document.getElementById("status")!;
const movesEl = document.getElementById("moves") as HTMLUListElement;
const gamesEl = document.getElementById("games") as HTMLUListElement;
const backBtn = document.getElementById("back") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const flipBtn = document.getElementById("flip") as HTMLButtonElement;
const sourceBtn = document.getElementById("source") as HTMLButtonElement;

const handle = await bootstrap<OpeningsProps>("lichess-openings");
const board = makeBoard(root);

interface State {
  rootFen: string;
  play: string[];
  currentFen: string;
  source: ExplorerSource;
  data: ExplorerData;
  orientation: Color;
}

const state: State = {
  rootFen: handle.props.rootFen,
  play: handle.props.play ? handle.props.play.split(",") : [],
  currentFen: handle.props.currentFen,
  source: handle.props.source,
  data: handle.props.initialData,
  orientation: "white",
};

function renderBoard() {
  const turn = turnColor(state.currentFen);
  const last = state.play.at(-1);
  const lastMove = last
    ? ([last.slice(0, 2) as Key, last.slice(2, 4) as Key] as [Key, Key])
    : undefined;
  board.set({
    fen: state.currentFen,
    orientation: state.orientation,
    turnColor: turn,
    lastMove,
    movable: {
      free: false,
      color: turn,
      dests: legalDestsFor(state.currentFen),
      events: { after: onUserMove },
    },
  });
}

function renderMoves() {
  movesEl.innerHTML = "";
  const total = state.data.white + state.data.draws + state.data.black;
  for (const m of state.data.moves ?? []) {
    const games = m.white + m.draws + m.black;
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = m.san;
    const right = document.createElement("span");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";
    const count = document.createElement("span");
    count.style.color = "var(--muted)";
    count.style.fontSize = "12px";
    count.textContent = total
      ? `${games.toLocaleString()} (${Math.round((games / total) * 100)}%)`
      : `${games.toLocaleString()}`;
    const bar = makeBar(m);
    right.append(count, bar);
    li.append(left, right);
    li.addEventListener("click", () => playMove(m.uci));
    movesEl.appendChild(li);
  }
  if (!state.data.moves || state.data.moves.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No games for this position.";
    li.style.cursor = "default";
    movesEl.appendChild(li);
  }
}

function makeBar(m: ExplorerMove): HTMLElement {
  const t = m.white + m.draws + m.black || 1;
  const bar = document.createElement("span");
  bar.className = "bar";
  const w = document.createElement("span");
  w.className = "w";
  w.style.flexBasis = `${(m.white / t) * 100}%`;
  const d = document.createElement("span");
  d.className = "d";
  d.style.flexBasis = `${(m.draws / t) * 100}%`;
  const b = document.createElement("span");
  b.className = "b";
  b.style.flexBasis = `${(m.black / t) * 100}%`;
  bar.append(w, d, b);
  return bar;
}

function renderGames() {
  gamesEl.innerHTML = "";
  const games = state.data.topGames ?? state.data.recentGames ?? [];
  for (const g of games.slice(0, 6)) {
    const li = document.createElement("li");
    const w = g.white?.name ?? "?";
    const wr = g.white?.rating ? ` (${g.white.rating})` : "";
    const b = g.black?.name ?? "?";
    const br = g.black?.rating ? ` (${g.black.rating})` : "";
    const left = document.createElement("span");
    left.textContent = `${w}${wr} vs ${b}${br}`;
    const right = document.createElement("span");
    right.style.color = "var(--muted)";
    right.style.fontSize = "12px";
    const winnerSymbol =
      g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½";
    right.textContent = `${winnerSymbol}${g.year ? " · " + g.year : ""}`;
    li.append(left, right);
    if (g.id) {
      li.style.cursor = "pointer";
      const url = `https://lichess.org/${g.id}`;
      li.title = url;
      li.addEventListener("click", () => {
        void handle.app.openLink({ url });
      });
    } else {
      li.style.cursor = "default";
    }
    gamesEl.appendChild(li);
  }
}

function renderMeta() {
  const total = state.data.white + state.data.draws + state.data.black;
  const parts: string[] = [];
  if (state.data.opening?.name) parts.push(state.data.opening.name);
  parts.push(state.source === "masters" ? "Masters" : "Lichess");
  parts.push(`${total.toLocaleString()} games`);
  metaEl.textContent = parts.join(" · ");
  sourceBtn.textContent =
    state.source === "masters" ? "Switch to Lichess" : "Switch to Masters";
  backBtn.disabled = state.play.length === 0;
  resetBtn.disabled = state.play.length === 0;
}

function loadProps(p: OpeningsProps) {
  state.rootFen = p.rootFen;
  state.play = p.play ? p.play.split(",") : [];
  state.currentFen = p.currentFen;
  state.source = p.source;
  state.data = p.initialData;
  setStatus("");
  renderBoard();
  renderMoves();
  renderGames();
  renderMeta();
}

function setStatus(msg: string, kind: "" | "ok" | "err" = "") {
  statusEl.textContent = msg;
  statusEl.className = `status${kind ? " " + kind : ""}`;
  if (!msg) statusEl.style.minHeight = "0";
  else statusEl.style.minHeight = "";
}

async function fetchExplorer(playArr: string[], source: ExplorerSource) {
  setStatus("Loading…");
  try {
    const result = await handle.app.callServerTool({
      name: "explore_openings",
      arguments: {
        fen: state.rootFen,
        play: playArr.join(","),
        source,
      },
    });
    if (result.isError) {
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "Server error";
      throw new Error(text);
    }
    const props = extractUiProps<OpeningsProps>(result);
    if (props) loadProps(props);
    else setStatus("Server returned no explorer data.", "err");
  } catch (err) {
    setStatus(`Failed to load: ${(err as Error).message}`, "err");
  }
}

function playMove(uci: string) {
  const next = applyUci(state.currentFen, uci);
  if (!next) {
    setStatus("Illegal move.", "err");
    return;
  }
  // Optimistically update board; the server response will refresh data.
  state.currentFen = next;
  state.play = [...state.play, uci];
  renderBoard();
  void fetchExplorer(state.play, state.source);
}

function onUserMove(orig: Key, dest: Key) {
  // Auto-promote to queen for explorer; the move is just navigation.
  const promo = needsPromotion(state.currentFen, orig, dest) ? "q" : undefined;
  playMove(toUci(orig, dest, promo));
}

function needsPromotion(fen: string, orig: Key, dest: Key): boolean {
  if (orig === "a0") return false;
  const chess = new Chess(fen);
  const piece = chess.get(orig);
  if (!piece || piece.type !== "p") return false;
  const destRank = parseInt(dest[1], 10);
  return destRank === 1 || destRank === 8;
}

backBtn.addEventListener("click", () => {
  if (state.play.length === 0) return;
  state.play = state.play.slice(0, -1);
  state.currentFen = applyAll(state.rootFen, state.play);
  renderBoard();
  void fetchExplorer(state.play, state.source);
});

resetBtn.addEventListener("click", () => {
  state.play = [];
  state.currentFen = state.rootFen;
  renderBoard();
  void fetchExplorer([], state.source);
});

flipBtn.addEventListener("click", () => {
  state.orientation = state.orientation === "white" ? "black" : "white";
  renderBoard();
});

sourceBtn.addEventListener("click", () => {
  const next = state.source === "masters" ? "lichess" : "masters";
  state.source = next;
  void fetchExplorer(state.play, next);
});

function applyAll(rootFen: string, play: string[]): string {
  let fen = rootFen;
  for (const uci of play) {
    const next = applyUci(fen, uci);
    if (!next) return fen;
    fen = next;
  }
  return fen;
}

titleEl.textContent = "Opening Explorer";
handle.onUpdate(loadProps);
loadProps(handle.props);
