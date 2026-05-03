import "../shared/theme.css";
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
  PuzzleProps,
  PuzzleSpec,
  PuzzleSubmitResult,
} from "../../types/ui-props.js";

interface Attempt {
  id: string;
  win: boolean;
}

interface IframeState {
  // Session
  session: { angle: string; rated: boolean };
  queue: PuzzleSpec[];
  index: number;
  attempts: Attempt[];

  // Per-puzzle live state
  fen: string;
  ply: number;
  mistakeMade: boolean;
  solved: boolean;
  viewOrientation: Color;
  done: boolean;
}

const root = document.getElementById("board")!;
const titleEl = document.getElementById("title")!;
const progressEl = document.getElementById("progress")!;
const metaEl = document.getElementById("meta")!;
const statusEl = document.getElementById("status")!;
const controlsEl = document.getElementById("controls")!;
const resultsEl = document.getElementById("results") as HTMLDivElement;
const hintBtn = document.getElementById("hint") as HTMLButtonElement;
const flipBtn = document.getElementById("flip") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
const linkEl = document.getElementById("lichess-link") as HTMLAnchorElement;

const handle = await bootstrap<PuzzleProps>("lichess-puzzle");
const board = makeBoard(root);

const state: IframeState = {
  session: handle.props.session,
  queue: handle.props.puzzles,
  index: 0,
  attempts: [],
  fen: "",
  ply: 0,
  mistakeMade: false,
  solved: false,
  viewOrientation: "white",
  done: false,
};

function current(): PuzzleSpec | undefined {
  return state.queue[state.index];
}

function setStatus(message: string, kind: "" | "ok" | "err" = "") {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? " " + kind : ""}`;
}

function applyState() {
  const spec = current();
  if (!spec) return;
  const userColor = spec.orientation;
  const turn = turnColor(state.fen);
  const isUserTurn = !state.solved && turn === userColor;

  board.set({
    fen: state.fen,
    orientation: state.viewOrientation,
    turnColor: turn,
    movable: {
      free: false,
      color: isUserTurn ? userColor : undefined,
      dests: isUserTurn ? legalDestsFor(state.fen) : new Map(),
      events: { after: onMove },
    },
    lastMove: undefined,
  });
}

function loadCurrent() {
  const spec = current();
  if (!spec) return;
  state.fen = spec.fen;
  state.ply = 0;
  state.mistakeMade = false;
  state.solved = false;
  state.viewOrientation = spec.orientation;

  titleEl.textContent = `Puzzle ${spec.puzzleId}`;
  const meta: string[] = [];
  if (spec.rating) meta.push(`rating ${spec.rating}`);
  meta.push(spec.orientation === "white" ? "white to play" : "black to play");
  if (spec.themes.length) meta.push(spec.themes.slice(0, 3).join(" · "));
  metaEl.textContent = meta.join(" · ");
  linkEl.href = spec.lichessUrl;
  linkEl.style.display = "";

  renderProgress();
  setStatus("Your move.");
  hintBtn.disabled = spec.solution.length === 0;
  flipBtn.disabled = false;
  applyState();
}

function renderProgress() {
  if (state.queue.length <= 1) {
    progressEl.textContent = state.session.rated ? "Rated session" : "";
    return;
  }
  const total = state.queue.length;
  const rated = state.session.rated ? "rated · " : "";
  progressEl.textContent = `${rated}puzzle ${state.index + 1} of ${total}`;
}

function loadProps(p: PuzzleProps) {
  state.session = p.session;
  state.queue = p.puzzles;
  state.index = 0;
  state.attempts = [];
  state.done = false;
  resultsEl.style.display = "none";
  resultsEl.innerHTML = "";
  controlsEl.style.display = "";
  nextBtn.disabled = false;
  if (state.queue.length === 0) {
    setStatus("No puzzles in this batch.", "err");
    titleEl.textContent = "No puzzles";
    metaEl.textContent = "";
    progressEl.textContent = "";
    nextBtn.disabled = true;
    hintBtn.disabled = true;
    flipBtn.disabled = true;
    return;
  }
  updateNextLabel();
  loadCurrent();
}

function updateNextLabel() {
  const isLast = state.index >= state.queue.length - 1;
  if (isLast && state.session.rated) {
    nextBtn.textContent = "Submit & view results";
    return;
  }
  if (state.queue.length <= 1) {
    nextBtn.textContent = "Next puzzle";
    return;
  }
  if (isLast) {
    nextBtn.textContent = "Finish";
  } else {
    nextBtn.textContent = "Next puzzle";
  }
}

async function onMove(orig: Key, dest: Key) {
  const spec = current();
  if (!spec || state.solved) return;
  const expected = spec.solution[state.ply];
  if (!expected) return;

  const isPromotion = needsPromotion(state.fen, orig, dest);
  let promotion: string | undefined;
  if (isPromotion) {
    const pawnColor = turnColor(state.fen);
    const choice = await pickPromotion(pawnColor, dest);
    if (!choice) {
      applyState();
      return;
    }
    promotion = choice;
  }
  const uci = toUci(orig, dest, promotion);

  if (uci !== expected) {
    state.mistakeMade = true;
    setStatus("Not the move. Try again.", "err");
    applyState();
    return;
  }

  const afterUser = applyUci(state.fen, expected);
  if (!afterUser) {
    setStatus("Move could not be applied.", "err");
    applyState();
    return;
  }
  state.fen = afterUser;
  state.ply += 1;
  setStatus("Correct!", "ok");
  applyState();

  const reply = spec.solution[state.ply];
  if (!reply) {
    finishCurrent();
    return;
  }
  await sleep(350);
  const afterReply = applyUci(state.fen, reply);
  if (!afterReply) {
    setStatus("Move could not be applied.", "err");
    return;
  }
  state.fen = afterReply;
  state.ply += 1;

  if (state.ply >= spec.solution.length) {
    finishCurrent();
  } else {
    setStatus("Your move.");
  }
  applyState();
}

function finishCurrent() {
  const spec = current();
  if (!spec) return;
  state.solved = true;
  const win = !state.mistakeMade;
  state.attempts.push({ id: spec.puzzleId, win });
  setStatus(win ? "Solved! ✓" : "Solved with mistakes.", win ? "ok" : "err");
  updateNextLabel();
}

function pickPromotion(pawnColor: Color, dest: Key): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = root.parentElement!;
    const overlay = document.createElement("div");
    overlay.className = "promo-overlay";

    const fileIdx = dest.charCodeAt(0) - "a".charCodeAt(0);
    const rankIdx = parseInt(dest[1], 10) - 1;
    const orient = state.viewOrientation;
    const xPct = (orient === "white" ? fileIdx : 7 - fileIdx) * 12.5;
    const yPctTop = (orient === "white" ? 7 - rankIdx : rankIdx) * 12.5;
    const direction = yPctTop === 0 ? 1 : -1;

    const pieces: { letter: string; symbol: string; name: string }[] = [
      { letter: "q", symbol: pawnColor === "white" ? "♕" : "♛", name: "Queen" },
      { letter: "r", symbol: pawnColor === "white" ? "♖" : "♜", name: "Rook" },
      { letter: "b", symbol: pawnColor === "white" ? "♗" : "♝", name: "Bishop" },
      { letter: "n", symbol: pawnColor === "white" ? "♘" : "♞", name: "Knight" },
    ];

    function done(value: string | null) {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") done(null);
    }

    pieces.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.className = "promo-piece";
      btn.type = "button";
      btn.title = p.name;
      btn.textContent = p.symbol;
      btn.style.left = `${xPct}%`;
      btn.style.top = `${yPctTop + direction * i * 12.5}%`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        done(p.letter);
      });
      overlay.appendChild(btn);
    });

    overlay.addEventListener("click", () => done(null));
    document.addEventListener("keydown", onKey);
    wrap.appendChild(overlay);
  });
}

function needsPromotion(fen: string, orig: Key, dest: Key): boolean {
  const ranks = fen.split(" ")[0].split("/");
  const fileIdx = orig.charCodeAt(0) - "a".charCodeAt(0);
  const rankIdx = 8 - parseInt(orig[1], 10);
  const row = ranks[rankIdx];
  let i = 0;
  let col = 0;
  while (i < row.length && col <= fileIdx) {
    const ch = row[i];
    if (/[1-8]/.test(ch)) {
      col += parseInt(ch, 10);
    } else {
      if (col === fileIdx) {
        if (ch.toLowerCase() !== "p") return false;
        const destRank = parseInt(dest[1], 10);
        return destRank === 1 || destRank === 8;
      }
      col += 1;
    }
    i += 1;
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

hintBtn.addEventListener("click", () => {
  const spec = current();
  if (!spec) return;
  const next = spec.solution[state.ply];
  if (!next) return;
  setStatus(`Hint: try ${next.slice(0, 2)} → ${next.slice(2, 4)}`);
});

flipBtn.addEventListener("click", () => {
  state.viewOrientation = state.viewOrientation === "white" ? "black" : "white";
  applyState();
});

nextBtn.addEventListener("click", async () => {
  // If the user has not finished the current puzzle yet, skip is treated as
  // a loss so the rated submit is honest.
  if (!state.solved) {
    const spec = current();
    if (spec) state.attempts.push({ id: spec.puzzleId, win: false });
  }

  // Unrated single-puzzle mode (daily / next / by-id): auto-fetch a fresh
  // puzzle. Rated nb=1 sessions fall through to the batch-submit path below.
  if (!state.session.rated && state.queue.length === 1) {
    nextBtn.disabled = true;
    setStatus("Loading next puzzle…");
    try {
      const result = await handle.app.callServerTool({
        name: "play_puzzle",
        arguments: { next: true },
      });
      if (result.isError) throw new Error(toolErrText(result));
      const props = extractUiProps<PuzzleProps>(result);
      if (props) loadProps(props);
      else {
        setStatus("Server returned no puzzle props.", "err");
        nextBtn.disabled = false;
      }
    } catch (err) {
      setStatus(`Failed to load next puzzle: ${(err as Error).message}`, "err");
      nextBtn.disabled = false;
    }
    return;
  }

  // Batch mode.
  if (state.index < state.queue.length - 1) {
    state.index += 1;
    updateNextLabel();
    loadCurrent();
    return;
  }

  // Last puzzle: submit (rated) or just show "done" (unrated batch).
  if (state.session.rated) {
    await submitBatch();
  } else {
    showUnratedDone();
  }
});

linkEl.addEventListener("click", (e) => {
  e.preventDefault();
  const url = current()?.lichessUrl ?? linkEl.href;
  if (url && url !== "#") void handle.app.openLink({ url });
});

function toolErrText(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.[0]?.type === "text" ? result.content[0].text ?? "Server error" : "Server error";
}

async function submitBatch() {
  nextBtn.disabled = true;
  setStatus("Submitting results to Lichess…");
  try {
    const result = await handle.app.callServerTool({
      name: "submit_puzzle_batch",
      arguments: {
        angle: state.session.angle,
        solutions: state.attempts.map((a) => ({ id: a.id, win: a.win, rated: true })),
      },
    });
    if (result.isError) throw new Error(toolErrText(result));
    const text = result.content?.[0]?.type === "text" ? result.content[0].text ?? "{}" : "{}";
    const data = JSON.parse(text) as PuzzleSubmitResult;
    showResults(data);
  } catch (err) {
    setStatus(`Failed to submit: ${(err as Error).message}`, "err");
    nextBtn.disabled = false;
  }
}

function showResults(data: PuzzleSubmitResult) {
  state.done = true;
  controlsEl.style.display = "none";
  setStatus("");
  resultsEl.style.display = "";

  const totalDelta = (data.rounds ?? []).reduce(
    (sum, r) => sum + (r.ratingDiff ?? 0),
    0,
  );

  const newRating = data.glicko?.rating;
  const sign = totalDelta >= 0 ? "+" : "";
  const headline = newRating
    ? `New puzzle rating: ${Math.round(newRating)} (${sign}${totalDelta})`
    : `Net change: ${sign}${totalDelta}`;

  const rounds = data.rounds ?? [];

  resultsEl.innerHTML = "";
  const h = document.createElement("div");
  h.className = "status ok";
  h.textContent = headline;
  resultsEl.appendChild(h);

  const list = document.createElement("ul");
  list.className = "move-list";
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = `${i + 1}. ${r.id} ${r.win ? "✓" : "✗"}`;
    const right = document.createElement("span");
    const rd = r.ratingDiff ?? 0;
    right.textContent = `${rd >= 0 ? "+" : ""}${rd}`;
    right.style.color = rd >= 0 ? "var(--accent)" : "var(--error)";
    li.append(left, right);
    list.appendChild(li);
  }
  resultsEl.appendChild(list);

  const newSession = document.createElement("div");
  newSession.className = "controls";
  newSession.style.marginTop = "10px";
  const startBtn = document.createElement("button");
  startBtn.className = "primary";
  startBtn.textContent = "Start another rated session";
  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    setStatus("Loading new session…");
    try {
      const result = await handle.app.callServerTool({
        name: "play_puzzle",
        arguments: {
          rated: true,
          angle: state.session.angle,
          nb: state.queue.length,
        },
      });
      if (result.isError) throw new Error(toolErrText(result));
      const props = extractUiProps<PuzzleProps>(result);
      if (props) loadProps(props);
      else {
        setStatus("Server returned no puzzle props.", "err");
        startBtn.disabled = false;
      }
    } catch (err) {
      setStatus(`Failed to start: ${(err as Error).message}`, "err");
      startBtn.disabled = false;
    }
  });
  newSession.appendChild(startBtn);
  resultsEl.appendChild(newSession);
}

function showUnratedDone() {
  state.done = true;
  setStatus("Batch complete. (Unrated — no rating change.)", "ok");
  nextBtn.disabled = true;
}

handle.onUpdate(loadProps);
loadProps(handle.props);
