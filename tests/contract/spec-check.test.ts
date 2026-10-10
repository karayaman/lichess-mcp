import { describe, it, expect } from "vitest";
import { checkRequest, type Spec, type CapturedRequest } from "./spec-check.js";

const spec: Spec = {
  servers: ["https://lichess.org"],
  paths: {
    "/api/user/{username}": {
      get: { parameters: [{ name: "trophies", in: "query", schema: { type: "boolean" } }] },
    },
    "/api/puzzle/next": {
      get: {
        parameters: [
          { name: "difficulty", in: "query", schema: { enum: ["easier", "normal", "harder"] } },
        ],
      },
    },
    "/team/{teamId}/join": {
      post: {
        requestBody: {
          content: {
            "application/x-www-form-urlencoded": {
              required: ["message"],
              properties: { message: {}, password: {} },
            },
          },
        },
      },
    },
    "/broadcast/new": { post: {} },
    "/api/broadcast/{tourSlug}/{roundSlug}/{roundId}": { get: {} },
    "/broadcast/{id}/players/{playerId}": { get: {} },
    "/broadcast/{id}": { get: {} },
    "/standard": { servers: ["https://tablebase.lichess.org"], get: {} },
  },
};

const get = (url: string): CapturedRequest => ({ url, method: "GET", contentType: null, body: null });
const form = (url: string, body: string): CapturedRequest => ({
  url,
  method: "POST",
  contentType: "application/x-www-form-urlencoded",
  body,
});

describe("checkRequest", () => {
  it("accepts a request that matches the spec", () => {
    expect(checkRequest(get("https://lichess.org/api/user/alice?trophies=true"), spec)).toEqual([]);
    expect(
      checkRequest(form("https://lichess.org/team/t1/join", "message=hi&password=x"), spec),
    ).toEqual([]);
  });

  it("flags a path the spec doesn't have", () => {
    expect(checkRequest(get("https://lichess.org/api/nope"), spec)).toEqual([
      "GET https://lichess.org/api/nope UNKNOWN_PATH",
    ]);
  });

  it("flags an /api prefix on an endpoint that lives at the site root", () => {
    expect(checkRequest(form("https://lichess.org/api/team/t1/join", "message=hi"), spec)).toEqual([
      "POST https://lichess.org/api/team/t1/join API_PREFIX spec path is /team/{teamId}/join",
    ]);
  });

  it("flags an /api prefix even when a looser /api template also matches", () => {
    // /api/broadcast/b1/players/p1 fits /api/broadcast/{tourSlug}/{roundSlug}/{roundId},
    // but /broadcast/{id}/players/{playerId} is the more literal match.
    expect(checkRequest(get("https://lichess.org/api/broadcast/b1/players/p1"), spec)).toEqual([
      "GET https://lichess.org/api/broadcast/b1/players/p1 API_PREFIX spec path is /broadcast/{id}/players/{playerId}",
    ]);
  });

  it("flags a method the path doesn't support", () => {
    expect(checkRequest({ ...get("https://lichess.org/api/user/alice"), method: "DELETE" }, spec)).toEqual([
      "DELETE https://lichess.org/api/user/alice WRONG_METHOD spec allows GET",
    ]);
  });

  it("prefers a literal path over a templated one", () => {
    expect(checkRequest({ ...get("https://lichess.org/broadcast/new"), method: "POST" }, spec)).toEqual([]);
  });

  it("flags the wrong host", () => {
    expect(checkRequest(get("https://lichess.org/standard"), spec)).toEqual([
      "GET /standard WRONG_HOST spec host is https://tablebase.lichess.org",
    ]);
  });

  it("flags unknown query params and bad values", () => {
    expect(checkRequest(get("https://lichess.org/api/user/alice?trophies=yes&x=1"), spec)).toEqual([
      'GET /api/user/{username} BAD_QUERY_VALUE trophies="yes" is not a boolean',
      "GET /api/user/{username} UNKNOWN_QUERY x",
    ]);
    expect(checkRequest(get("https://lichess.org/api/puzzle/next?difficulty=hard"), spec)).toEqual([
      'GET /api/puzzle/next BAD_QUERY_VALUE difficulty="hard" not in [easier, normal, harder]',
    ]);
  });

  it("flags unknown and missing body fields", () => {
    expect(checkRequest(form("https://lichess.org/team/t1/join", "msg=hi"), spec)).toEqual([
      "POST /team/{teamId}/join UNKNOWN_FIELD msg",
      "POST /team/{teamId}/join MISSING_FIELD message",
    ]);
  });

  it("flags the wrong content type", () => {
    const request: CapturedRequest = {
      url: "https://lichess.org/team/t1/join",
      method: "POST",
      contentType: "application/json",
      body: '{"message":"hi"}',
    };
    expect(checkRequest(request, spec)).toEqual([
      "POST /team/{teamId}/join WRONG_CONTENT_TYPE sent application/json, spec wants application/x-www-form-urlencoded",
    ]);
  });

  it("flags a body sent to an operation that takes none", () => {
    expect(checkRequest(form("https://lichess.org/broadcast/new", "a=1"), spec)).toEqual([
      "POST /broadcast/new UNEXPECTED_BODY",
    ]);
  });
});
