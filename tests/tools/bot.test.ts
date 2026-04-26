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

describe("get_online_bots", () => {
  it("GETs /api/bot/online as ndjson without auth", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "bot1" }, { id: "bot2" }]);

    const result = await findTool("get_online_bots").handler({ nb: 100 }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/bot/online");
    expect(init.headers.get("Authorization")).toBeNull();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects nb > 512 (schema validation)", () => {
    expect(() => findTool("get_online_bots").schema.parse({ nb: 513 })).toThrow();
  });
});

describe("stream_bot_game", () => {
  it("returns empty object when response body is empty", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    const result = await findTool("stream_bot_game").handler({ gameId: "game1" }, makeContext());

    expect(result).toEqual({});
  });

  it("GETs /api/bot/game/stream/{gameId} and returns first event", async () => {
    const mock = installFetchMock();
    mock.respondText('{"type":"gameFull","id":"game1"}\n');

    const result = await findTool("stream_bot_game").handler({ gameId: "game1" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/bot/game/stream/game1"));
    expect(result).toMatchObject({ type: "gameFull" });
  });
});

describe("make_bot_move", () => {
  it("POSTs to /api/bot/game/{gameId}/move/{move}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("make_bot_move").handler({ gameId: "game1", move: "e2e4" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/move/e2e4") });
  });

  it("appends offeringDraw=true when requested", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("make_bot_move").handler(
      { gameId: "game1", move: "e2e4", offeringDraw: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("offeringDraw=true");
  });
});

describe("write_bot_chat", () => {
  it("POSTs form data to /api/bot/game/{gameId}/chat", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("write_bot_chat").handler(
      { gameId: "game1", room: "player", text: "gg" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/bot/game/game1/chat"));
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("room=player");
    expect(init.body?.toString()).toContain("text=gg");
  });
});

describe("get_bot_game_chat", () => {
  it("GETs /api/bot/game/{gameId}/chat", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_bot_game_chat").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/bot/game/game1/chat") });
  });
});

describe("abort_bot_game", () => {
  it("POSTs to /api/bot/game/{gameId}/abort", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("abort_bot_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/abort") });
  });
});

describe("resign_bot_game", () => {
  it("POSTs to /api/bot/game/{gameId}/resign", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("resign_bot_game").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/resign") });
  });
});

describe("handle_bot_draw", () => {
  it("POSTs to /api/bot/game/{gameId}/draw/yes", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_bot_draw").handler({ gameId: "game1", accept: true }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/draw/yes") });
  });

  it("POSTs to /draw/no when declined", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_bot_draw").handler({ gameId: "game1", accept: false }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("draw/no");
  });
});

describe("handle_bot_takeback", () => {
  it("POSTs to /api/bot/game/{gameId}/takeback/no when declined", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    const result = await findTool("handle_bot_takeback").handler(
      { gameId: "game1", accept: false },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("takeback/no");
    expect(String(result)).toContain("declined");
  });

  it("POSTs to /api/bot/game/{gameId}/takeback/yes", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("handle_bot_takeback").handler(
      { gameId: "game1", accept: true },
      makeContext(),
    );

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/takeback/yes") });
  });
});

describe("claim_bot_victory", () => {
  it("POSTs to /api/bot/game/{gameId}/claim-victory", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("claim_bot_victory").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/claim-victory") });
  });
});

describe("claim_bot_draw", () => {
  it("POSTs to /api/bot/game/{gameId}/claim-draw", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("claim_bot_draw").handler({ gameId: "game1" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/game/game1/claim-draw") });
  });
});
