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

// Only GET /api/simul is in the public spec.
// create_simul, join_simul, withdraw_from_simul use non-public endpoints
// but are kept for usability.

describe("get_current_simuls", () => {
  it("GETs /api/simul", async () => {
    const mock = installFetchMock();
    mock.respondJson({ ongoing: [], created: [] });

    await findTool("get_current_simuls").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/simul") });
  });
});

describe("create_simul", () => {
  it("POSTs JSON to /api/simul/new", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newSimul" });

    await findTool("create_simul").handler(
      {
        name: "My Simul",
        variant: "standard",
        clockTime: 5,
        clockIncrement: 3,
        color: "white",
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/simul/new"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("join_simul", () => {
  it("POSTs to /api/simul/{id}/join", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("join_simul").handler({ simulId: "mySimul" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/simul/mySimul/join") });
  });
});

describe("withdraw_from_simul", () => {
  it("POSTs to /api/simul/{id}/withdraw", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("withdraw_from_simul").handler({ simulId: "mySimul" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/simul/mySimul/withdraw") });
  });
});
