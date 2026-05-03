import "../shared/theme.css";
import { Chess } from "chess.js";
import { bootstrap } from "../shared/app-bootstrap.js";
import { makeBoard } from "../shared/board.js";
import type { Color, Key } from "../shared/board.js";
import type { PgnProps } from "../../types/ui-props.js";

interface MoveStep {
  san: string;
  from: Key;
  to: Key;
  fen: string;
  color: Color;
  moveNumber: number;
}

const root = document.getElementById("board")!;
const titleEl = document.getElementById("title")!;
const metaEl = document.getElementById("meta")!;
const movesEl = document.getElementById("moves") as HTMLOListElement;
const linkEl = document.getElementById("lichess-link") as HTMLAnchorElement;
const firstBtn = document.getElementById("first") as HTMLButtonElement;
const prevBtn = document.getElementById("prev") as HTMLButtonElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
const lastBtn = document.getElementById("last") as HTMLButtonElement;
const flipBtn = document.getElementById("flip") as HTMLButtonElement;

function showError(message: string) {
  titleEl.textContent = "Could not load PGN";
  metaEl.textContent = message;
  movesEl.innerHTML = "";
  linkEl.style.display = "none";
}

let handle: Awaited<ReturnType<typeof bootstrap<PgnProps>>>;
try {
  handle = await bootstrap<PgnProps>("lichess-pgn");
} catch (err) {
  showError(err instanceof Error ? err.message : String(err));
  throw err;
}
const board = makeBoard(root, { viewOnly: true });

let steps: MoveStep[] = [];
let startFen = "";
let ply = 0;
let orientation: Color = "white";
let playing = false;
let timer: number | undefined;

function loadProps(p: PgnProps) {
  try {
    const chess = new Chess();
    chess.loadPgn(p.pgn);
    const history = chess.history({ verbose: true }) as Array<{
      from: Key;
      to: Key;
      san: string;
      color: "w" | "b";
      promotion?: string;
    }>;
    // Replay to capture FEN after each move. Seed from the PGN's [FEN] header so
    // setup-position games (chess960, studies, problems) replay from the right start.
    const replay = p.headers.fen ? new Chess(p.headers.fen) : new Chess();
    startFen = replay.fen();
    steps = history.map((m) => {
      const moveNumber = Number(replay.fen().split(" ")[5] ?? "1");
      replay.move({ from: m.from, to: m.to, promotion: m.promotion });
      return {
        san: m.san,
        from: m.from,
        to: m.to,
        fen: replay.fen(),
        color: m.color === "w" ? "white" : "black",
        moveNumber,
      };
    });

    ply = 0;
    orientation = "white";

    titleEl.textContent = p.headers.event || "Game";
    const metaParts: string[] = [];
    const w = p.headers.white ?? "";
    const b = p.headers.black ?? "";
    if (w || b) {
      const wElo = p.headers.whiteElo ? ` (${p.headers.whiteElo})` : "";
      const bElo = p.headers.blackElo ? ` (${p.headers.blackElo})` : "";
      metaParts.push(`${w || "?"}${wElo} vs ${b || "?"}${bElo}`);
    }
    if (p.headers.date) metaParts.push(p.headers.date);
    if (p.headers.result) metaParts.push(p.headers.result);
    metaEl.textContent = metaParts.join(" · ");

    if (p.lichessUrl) {
      linkEl.href = p.lichessUrl;
      linkEl.style.display = "";
    } else {
      linkEl.style.display = "none";
    }

    renderMoves();
    applyBoard();
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
}

function applyBoard() {
  const fen = ply === 0 ? startFen : steps[ply - 1].fen;
  const lastMove = ply === 0 ? undefined : [steps[ply - 1].from, steps[ply - 1].to] as [Key, Key];
  board.set({ fen, orientation, lastMove });
  updateMoveHighlight();
  prevBtn.disabled = ply === 0;
  firstBtn.disabled = ply === 0;
  nextBtn.disabled = ply >= steps.length;
  lastBtn.disabled = ply >= steps.length;
}

function renderMoves() {
  movesEl.innerHTML = "";
  for (let i = 0; i < steps.length;) {
    const moveNum = steps[i].moveNumber;
    const whiteIdx = steps[i].color === "white" ? i : -1;
    const blackIdx =
      whiteIdx === -1
        ? i
        : steps[i + 1]?.color === "black" && steps[i + 1]?.moveNumber === moveNum
          ? i + 1
          : -1;

    const li = document.createElement("li");
    li.className = "pgn-move-row";

    const num = document.createElement("span");
    num.className = "pgn-move-number";
    num.textContent = `${moveNum}.`;

    li.append(num, makeMoveCell(whiteIdx, "white"), makeMoveCell(blackIdx, "black"));
    movesEl.appendChild(li);

    i = blackIdx > whiteIdx ? blackIdx + 1 : i + 1;
  }
}

function updateMoveHighlight() {
  const items = movesEl.querySelectorAll<HTMLElement>("[data-ply]");
  items.forEach((item) => item.classList.remove("current"));
  if (ply > 0) {
    const current = movesEl.querySelector<HTMLElement>(`[data-ply="${ply}"]`);
    current?.classList.add("current");
    current?.scrollIntoView({ block: "nearest" });
  }
}

function makeMoveCell(idx: number, side: Color): HTMLElement {
  if (idx < 0) {
    const empty = document.createElement("span");
    empty.className = "pgn-move pgn-move-placeholder";
    empty.setAttribute("aria-hidden", "true");
    return empty;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pgn-move";
  button.textContent = steps[idx].san;
  button.dataset.ply = String(idx + 1);
  button.setAttribute(
    "aria-label",
    `Go to ${steps[idx].moveNumber}${side === "white" ? "." : "..."} ${steps[idx].san}`,
  );
  button.addEventListener("click", () => {
    ply = idx + 1;
    stopPlaying();
    applyBoard();
  });
  return button;
}

function stopPlaying() {
  playing = false;
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
  playBtn.textContent = "▶";
}

function startPlaying() {
  if (ply >= steps.length) {
    ply = 0;
    applyBoard();
  }
  playing = true;
  playBtn.textContent = "⏸";
  timer = window.setInterval(() => {
    if (ply >= steps.length) {
      stopPlaying();
      return;
    }
    ply += 1;
    applyBoard();
  }, 1500);
}

firstBtn.addEventListener("click", () => { stopPlaying(); ply = 0; applyBoard(); });
prevBtn.addEventListener("click", () => { stopPlaying(); if (ply > 0) ply -= 1; applyBoard(); });
nextBtn.addEventListener("click", () => { stopPlaying(); if (ply < steps.length) ply += 1; applyBoard(); });
lastBtn.addEventListener("click", () => { stopPlaying(); ply = steps.length; applyBoard(); });
playBtn.addEventListener("click", () => { playing ? stopPlaying() : startPlaying(); });
flipBtn.addEventListener("click", () => {
  orientation = orientation === "white" ? "black" : "white";
  applyBoard();
});

linkEl.addEventListener("click", (e) => {
  e.preventDefault();
  const url = linkEl.href;
  if (url && url !== "#") void handle.app.openLink({ url });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevBtn.click();
  else if (e.key === "ArrowRight") nextBtn.click();
  else if (e.key === " ") { e.preventDefault(); playBtn.click(); }
});

handle.onUpdate(loadProps);
loadProps(handle.props);
