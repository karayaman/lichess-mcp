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

describe("get_tv_channels", () => {
  it("GETs /api/tv/channels without auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ blitz: { gameId: "abc" } });

    await findTool("get_tv_channels").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/tv/channels"));
    expect(init.headers.get("Authorization")).not.toBeNull();
  });
});

describe("get_tv_game", () => {
  it("GETs /api/tv when no channel specified", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("get_tv_game").handler({}, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/tv"));
  });

  it("returns JSON data when server responds with JSON content-type", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "abc", players: [] });

    const result = await findTool("get_tv_game").handler({}, makeContext());

    expect(result).toMatchObject({ id: "abc" });
  });

  it("GETs /api/tv/{channel} when channel specified", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("get_tv_game").handler({ channel: "blitz" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/tv/blitz"));
  });

  it("rejects invalid channel (schema validation)", () => {
    expect(() =>
      findTool("get_tv_game").schema.parse({ channel: "notachannel" }),
    ).toThrow();
  });
});

describe("get_tv_feed", () => {
  it("returns empty object when response body is empty", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    const result = await findTool("get_tv_feed").handler({}, makeContext());

    expect(result).toEqual({});
  });

  it("GETs /api/tv/feed without auth and parses first NDJSON line", async () => {
    const mock = installFetchMock();
    mock.respondText('{"t":"featured","d":{"id":"abc"}}\n{"t":"fen","d":{"fen":"..."}}');

    const result = await findTool("get_tv_feed").handler({}, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/tv/feed"));
    expect(init.headers.get("Authorization")).toBeNull();
    expect(result).toMatchObject({ t: "featured" });
  });
});

describe("get_tv_channel_feed", () => {
  it("returns empty object when response body is empty", async () => {
    const mock = installFetchMock();
    mock.respondText("");

    const result = await findTool("get_tv_channel_feed").handler({ channel: "blitz" }, makeContext());

    expect(result).toEqual({});
  });

  it("GETs /api/tv/{channel}/feed without auth", async () => {
    const mock = installFetchMock();
    mock.respondText('{"t":"featured","d":{"id":"abc"}}');

    const result = await findTool("get_tv_channel_feed").handler(
      { channel: "rapid" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/tv/rapid/feed"));
    expect(init.headers.get("Authorization")).toBeNull();
    expect(result).toMatchObject({ t: "featured" });
  });

  it("rejects invalid channel (schema validation)", () => {
    expect(() =>
      findTool("get_tv_channel_feed").schema.parse({ channel: "notachannel" }),
    ).toThrow();
  });
});
