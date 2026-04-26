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

describe("get_following", () => {
  it("GETs /api/rel/following as ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "alice" }, { id: "bob" }]);

    const result = await findTool("get_following").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/rel/following") });
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(2);
  });
});

describe("follow_user", () => {
  it("POSTs to /api/rel/follow/{username}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    const result = await findTool("follow_user").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/rel/follow/alice") });
    expect(String(result)).toContain("alice");
  });

  it("encodes username", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("follow_user").handler({ username: "a b" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
  });
});

describe("unfollow_user", () => {
  it("POSTs to /api/rel/unfollow/{username}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("unfollow_user").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/rel/unfollow/alice") });
  });
});

describe("block_user", () => {
  it("POSTs to /api/rel/block/{username}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("block_user").handler({ username: "spammer" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/rel/block/spammer") });
  });
});

describe("unblock_user", () => {
  it("POSTs to /api/rel/unblock/{username}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("unblock_user").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/rel/unblock/alice") });
  });
});
