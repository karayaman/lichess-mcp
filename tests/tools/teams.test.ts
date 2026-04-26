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

describe("get_team_info", () => {
  it("GETs /api/team/{teamId}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "lichess-coders" });

    await findTool("get_team_info").handler({ teamId: "lichess-coders" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/team/lichess-coders") });
  });
});

describe("get_team_members", () => {
  it("GETs /api/team/{teamId}/users with max param", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "alice" }]);

    await findTool("get_team_members").handler(
      { teamId: "lichess-coders", max: 50 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/team/lichess-coders/users");
    expect(url).toContain("max=50");
  });
});

describe("get_team_join_requests", () => {
  it("GETs /api/team/{teamId}/requests", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("get_team_join_requests").handler(
      { teamId: "lichess-coders" },
      makeContext(),
    );

    expectFetch(mock, { method: "GET", url: apiUrl("/team/lichess-coders/requests") });
  });
});

describe("join_team", () => {
  it("POSTs form data to /api/team/{teamId}/join", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("join_team").handler(
      { teamId: "lichess-coders", message: "Please let me join!" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/team/lichess-coders/join");
    expect(init.body?.toString()).toContain("message=Please+let+me+join%21");
  });
});

describe("leave_team", () => {
  it("POSTs to /api/team/{teamId}/quit", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("leave_team").handler({ teamId: "lichess-coders" }, makeContext());

    expectFetch(mock, { method: "POST", url: apiUrl("/team/lichess-coders/quit") });
  });
});

describe("kick_user_from_team", () => {
  it("POSTs to /api/team/{teamId}/kick/{userId}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("kick_user_from_team").handler(
      { teamId: "lichess-coders", userId: "baduser" },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/team/lichess-coders/kick/baduser"),
    });
  });
});

describe("accept_join_request", () => {
  it("POSTs to /api/team/{teamId}/request/{userId}/accept", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("accept_join_request").handler(
      { teamId: "lichess-coders", userId: "newuser" },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/team/lichess-coders/request/newuser/accept"),
    });
  });
});

describe("decline_join_request", () => {
  it("POSTs to /api/team/{teamId}/request/{userId}/decline", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("decline_join_request").handler(
      { teamId: "lichess-coders", userId: "spamuser" },
      makeContext(),
    );

    expectFetch(mock, {
      method: "POST",
      url: apiUrl("/team/lichess-coders/request/spamuser/decline"),
    });
  });
});

describe("search_teams", () => {
  it("GETs /api/team/search with text and page params", async () => {
    const mock = installFetchMock();
    mock.respondJson({ currentPage: 1, results: [] });

    await findTool("search_teams").handler({ text: "chess", page: 1 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/team/search");
    expect(url).toContain("text=chess");
    expect(url).toContain("page=1");
  });
});

describe("get_team_swiss_tournaments", () => {
  it("GETs /api/team/{teamId}/swiss", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "swiss1" }]);

    await findTool("get_team_swiss_tournaments").handler(
      { teamId: "lichess-coders" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/team/lichess-coders/swiss"));
  });

  it("includes max and status params", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_team_swiss_tournaments").handler(
      { teamId: "lichess-coders", max: 5, status: 30 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("max=5");
    expect(url).toContain("status=30");
  });
});

describe("get_all_teams", () => {
  it("GETs /api/team/all", async () => {
    const mock = installFetchMock();
    mock.respondJson({ currentPage: 1, results: [] });

    await findTool("get_all_teams").handler({ page: 1 }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/team/all?page=1"));
  });
});

describe("get_teams_of_user", () => {
  it("GETs /api/team/of/{username}", async () => {
    const mock = installFetchMock();
    mock.respondJson([{ id: "myteam" }]);

    await findTool("get_teams_of_user").handler({ username: "alice" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/team/of/alice") });
  });
});

describe("get_team_arena_tournaments", () => {
  it("GETs /api/team/{teamId}/arena", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "arena1" }]);

    await findTool("get_team_arena_tournaments").handler(
      { teamId: "lichess-coders" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/team/lichess-coders/arena"));
  });

  it("includes max and status params", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([]);

    await findTool("get_team_arena_tournaments").handler(
      { teamId: "lichess-coders", max: 5, status: 30 },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("max=5");
    expect(url).toContain("status=30");
  });
});

describe("pm_all_team_members", () => {
  it("POSTs form message to /team/{teamId}/pm-all", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("pm_all_team_members").handler(
      { teamId: "lichess-coders", message: "Tournament starting soon!" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/team/lichess-coders/pm-all");
    expect(init.body?.toString()).toContain("message=Tournament+starting+soon%21");
  });
});
