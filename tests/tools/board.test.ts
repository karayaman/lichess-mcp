import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
} from "../helpers/mock.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("make_board_move", () => {
  it("POSTs to /api/board/game/{gameId}/move/{move}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    const result = await findTool("make_board_move").handler(
      { gameId: "game1", move: "e2e4" },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/board/game/game1/move/e2e4"),
    });
    expect(String(result)).toContain("e2e4");
  });

  it("appends offeringDraw=true when requested", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("make_board_move").handler(
      { gameId: "game1", move: "e2e4", offeringDraw: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("offeringDraw=true");
  });
});

describe("make_move", () => {
  it("POSTs to /api/board/game/{gameId}/move/{move}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("make_move").handler(
      { gameId: "game1", move: "d7d5", offeringDraw: false },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/board/game/game1/move/d7d5"),
    });
  });

  it("appends offeringDraw=true and includes draw offer in message", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    const result = await findTool("make_move").handler(
      { gameId: "game1", move: "e2e4", offeringDraw: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("offeringDraw=true");
    expect(String(result)).toContain("with draw offer");
  });
});

describe("abort_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/abort", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("abort_board_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/abort") });
  });
});

describe("resign_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/resign", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("resign_board_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/resign") });
  });
});

describe("write_in_chat", () => {
  it("POSTs form data to /api/board/game/{gameId}/chat", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("write_in_chat").handler(
      { gameId: "game1", room: "player", text: "Good game!" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/board/game/game1/chat"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("room=player");
    expect(init.body?.toString()).toContain("text=Good+game%21");
  });
});

describe("handle_draw_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/draw/yes when accept=true", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_draw_board_game").handler(
      { gameId: "game1", accept: true },
      makeContext(),
    );

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/draw/yes") });
  });

  it("POSTs to /draw/no when accept=false", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_draw_board_game").handler(
      { gameId: "game1", accept: false },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("draw/no");
  });
});

describe("claim_victory", () => {
  it("POSTs to /api/board/game/{gameId}/claim-victory", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("claim_victory").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/claim-victory") });
  });
});

describe("stream_events", () => {
  it("returns empty object when response body is empty", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    const result = await findTool("stream_events").handler({}, makeContext());

    expect(result).toEqual({});
  });

  it("GETs /api/stream/event and parses first NDJSON line", async () => {
    const mock = installFetchMock();
    mock.respondText('{"type":"challenge","challenge":{"id":"abc"}}\n');

    const result = await findTool("stream_events").handler({}, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/stream/event"));
    expect(result).toMatchObject({ type: "challenge" });
  });
});

describe("create_seek", () => {
  it("POSTs form data to /api/board/seek", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    await findTool("create_seek").handler(
      { rated: false, time: 5, increment: 3, variant: "standard" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/board/seek"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("time=5");
    expect(init.body?.toString()).toContain("increment=3");
  });
});

describe("stream_board_game", () => {
  it("returns empty object when response body is empty", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    const result = await findTool("stream_board_game").handler({ gameId: "game1" }, makeContext());

    expect(result).toEqual({});
  });

  it("GETs /api/board/game/stream/{gameId} and parses first NDJSON line", async () => {
    const mock = installFetchMock();
    mock.respondText('{"type":"gameFull","id":"game1"}\n');

    const result = await findTool("stream_board_game").handler(
      { gameId: "game1" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/board/game/stream/game1"));
    expect(result).toMatchObject({ type: "gameFull" });
  });
});

describe("get_board_game_chat", () => {
  it("GETs /api/board/game/{gameId}/chat", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ text: "gg", username: "alice" }]);

    await findTool("get_board_game_chat").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/board/game/game1/chat") });
  });
});

describe("handle_takeback_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/takeback/yes when accept=true", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_takeback_board_game").handler(
      { gameId: "game1", accept: true },
      makeContext(),
    );

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/takeback/yes") });
  });

  it("POSTs to /takeback/no when accept=false", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_takeback_board_game").handler(
      { gameId: "game1", accept: false },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("takeback/no");
  });
});

describe("claim_draw_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/claim-draw", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("claim_draw_board_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/claim-draw") });
  });
});

describe("berserk_board_game", () => {
  it("POSTs to /api/board/game/{gameId}/berserk", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("berserk_board_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/board/game/game1/berserk") });
  });
});
