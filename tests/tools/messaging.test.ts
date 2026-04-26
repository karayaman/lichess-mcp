import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installFetchMock,
  makeContext,
  findTool,
  expectFetch,
} from "../helpers/mock.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("send_message", () => {
  it("POSTs text to /inbox/{username}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("send_message").handler(
      { username: "alice", text: "Hello!" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe("https://lichess.org/api/inbox/alice");
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init.body?.toString()).toContain("text=Hello%21");
  });

  it("encodes special characters in username", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("send_message").handler(
      { username: "a b", text: "hi" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
  });

  it("rejects empty text (schema validation)", () => {
    expect(() =>
      findTool("send_message").schema.parse({ username: "alice", text: "" }),
    ).toThrow();
  });
});

// NOTE: get_thread (GET /inbox/{userId}) is not in the public Lichess API spec
// but is kept for backward compatibility. It is tested here as-is.
describe("get_thread", () => {
  it("GETs /inbox/{userId}", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ text: "Hello", user: { id: "alice" } }]);

    await findTool("get_thread").handler({ userId: "alice" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe("https://lichess.org/api/inbox/alice");
  });

  it("encodes userId", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_thread").handler({ userId: "a b" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("a%20b");
  });
});
