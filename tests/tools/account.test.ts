import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
  apiUrl,
} from "../helpers/mock.js";
import { TokenStore } from "../../src/http/token-store.js";
import { LichessApiError } from "../../src/http/errors.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── set_token ────────────────────────────────────────────────────────────────

describe("set_token", () => {
  it("stores the token and returns confirmation", async () => {
    const ctx = makeContext({ token: undefined });
    const result = await findTool("set_token").handler({ token: "my-new-token" }, ctx);
    expect(result).toContain("set");
    expect(ctx.tokens.get()).toBe("my-new-token");
  });

  it("rejects empty token string (schema validation)", () => {
    expect(() => findTool("set_token").schema.parse({ token: "" })).toThrow();
  });
});

// ─── get_my_profile ───────────────────────────────────────────────────────────

describe("get_my_profile", () => {
  it("GETs /api/account with bearer auth", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "myuser", username: "myuser" });

    const ctx = makeContext();
    const result = await findTool("get_my_profile").handler({}, ctx);

    expectFetch(mock, {
      method: "GET",
      url: apiUrl("/account"),
      headers: { Authorization: "Bearer test-token" },
    });
    expect(result).toMatchObject({ id: "myuser" });
  });
});

// ─── get_user_profile ─────────────────────────────────────────────────────────

describe("get_user_profile", () => {
  it("GETs /api/user/{username}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "thibault" });

    await findTool("get_user_profile").handler(
      { username: "thibault", trophies: false },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/user/thibault") });
  });

  it("appends ?trophies=true when requested", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "thibault" });

    await findTool("get_user_profile").handler(
      { username: "thibault", trophies: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/user/thibault?trophies=true"));
  });

  it("encodes special characters in username", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "a b" });

    await findTool("get_user_profile").handler(
      { username: "a b", trophies: false },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/user/a%20b"));
  });
});

// ─── get_my_email ─────────────────────────────────────────────────────────────

describe("get_my_email", () => {
  it("returns the email address from response", async () => {
    const mock = installFetchMock();
    mock.respondJson({ email: "user@example.com" });

    const result = await findTool("get_my_email").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/account/email") });
    expect(result).toContain("user@example.com");
  });
});

// ─── get_kid_mode ─────────────────────────────────────────────────────────────

describe("get_kid_mode", () => {
  it("returns enabled message when kid=true", async () => {
    const mock = installFetchMock();
    mock.respondJson({ kid: true });

    const result = await findTool("get_kid_mode").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/account/kid") });
    expect(String(result)).toContain("enabled");
  });

  it("returns disabled message when kid=false", async () => {
    const mock = installFetchMock();
    mock.respondJson({ kid: false });

    const result = await findTool("get_kid_mode").handler({}, makeContext());
    expect(String(result)).toContain("disabled");
  });
});

// ─── set_kid_mode ─────────────────────────────────────────────────────────────

describe("set_kid_mode", () => {
  it("POSTs to /api/account/kid with value=true", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("set_kid_mode").handler({ value: true }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/account/kid?v=true"));
  });

  it("POSTs with value=false", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("set_kid_mode").handler({ value: false }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/account/kid?v=false"));
  });
});

// ─── get_preferences ──────────────────────────────────────────────────────────

describe("get_preferences", () => {
  it("GETs /api/account/preferences", async () => {
    const mock = installFetchMock();
    mock.respondJson({ prefs: { dark: true } });

    await findTool("get_preferences").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/account/preferences") });
  });
});

// ─── get_timeline ─────────────────────────────────────────────────────────────

describe("get_timeline", () => {
  it("sends default nb=15", async () => {
    const mock = installFetchMock();
    mock.respondJson({ entries: [] });

    await findTool("get_timeline").handler({ nb: 15 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("nb=15");
  });

  it("includes since when provided", async () => {
    const mock = installFetchMock();
    mock.respondJson({ entries: [] });

    await findTool("get_timeline").handler({ nb: 10, since: 1700000000000 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("since=1700000000000");
    expect(url).toContain("nb=10");
  });

  it("rejects nb > 30 (schema validation)", () => {
    expect(() => findTool("get_timeline").schema.parse({ nb: 31 })).toThrow();
  });
});

// ─── test_tokens ──────────────────────────────────────────────────────────────

describe("test_tokens", () => {
  it("POSTs to /api/token/test without auth header", async () => {
    const mock = installFetchMock();
    mock.respondJson({ token1: { userId: "alice" } });

    await findTool("test_tokens").handler({ tokens: "token1,token2" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/token/test"));
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("rejects more than 1000 tokens", async () => {
    const tooMany = Array.from({ length: 1001 }, (_, i) => `tok${i}`).join(",");
    await expect(
      findTool("test_tokens").handler({ tokens: tooMany }, makeContext()),
    ).rejects.toThrow("1000");
  });
});

// ─── revoke_token ─────────────────────────────────────────────────────────────

describe("revoke_token", () => {
  it("DELETEs /api/token and clears the stored token", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    const ctx = makeContext();
    await findTool("revoke_token").handler({}, ctx);

    expectFetch(mock, { method: "DELETE", url: apiUrl("/token") });
    expect(ctx.tokens.get()).toBeUndefined();
  });

  it("throws if no token is set", async () => {
    const ctx = makeContext({ token: undefined });
    // Manually clear the token via TokenStore
    const ts = new TokenStore(undefined);
    const client = ctx.client;
    await expect(
      findTool("revoke_token").handler({}, { client, tokens: ts }),
    ).rejects.toThrow();
  });
});

// ─── upgrade_to_bot ───────────────────────────────────────────────────────────

describe("upgrade_to_bot", () => {
  it("POSTs to /api/bot/account/upgrade", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("upgrade_to_bot").handler({}, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/bot/account/upgrade") });
  });
});

// ─── add_user_note ────────────────────────────────────────────────────────────

describe("add_user_note", () => {
  it("POSTs form data to /api/user/{username}/note", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("add_user_note").handler(
      { username: "alice", text: "Great player" },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/user/alice/note"),
      bodyContains: "text=Great+player",
    });
  });

  it("encodes special characters in username", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("add_user_note").handler(
      { username: "a b", text: "note" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/user/a%20b/note"));
  });

  it("rejects empty text (schema validation)", () => {
    expect(() =>
      findTool("add_user_note").schema.parse({ username: "alice", text: "" }),
    ).toThrow();
  });
});

// ─── API error propagation ────────────────────────────────────────────────────

describe("API error propagation", () => {
  it("get_my_profile surfaces LichessApiError on 401", async () => {
    const mock = installFetchMock();
    mock.respondStatus(401, '{"error":"Unauthorized"}');

    await expect(findTool("get_my_profile").handler({}, makeContext())).rejects.toBeInstanceOf(
      LichessApiError,
    );
  });
});
