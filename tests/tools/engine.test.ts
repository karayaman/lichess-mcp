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

describe("list_external_engines", () => {
  it("GETs /api/external-engine", async () => {
    const mock = installFetchMock();
    mock.respondJson([]);

    await findTool("list_external_engines").handler({}, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/external-engine") });
  });
});

describe("create_external_engine", () => {
  it("POSTs JSON to /api/external-engine", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "eng1", name: "Stockfish 15" });

    await findTool("create_external_engine").handler(
      {
        name: "Stockfish 15",
        maxThreads: 8,
        maxHash: 2048,
        providerSecret: "secretsecretsecretsecret",
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Stockfish 15");
    expect(body.maxThreads).toBe(8);
  });

  it("rejects name shorter than 3 chars (schema validation)", () => {
    expect(() =>
      findTool("create_external_engine").schema.parse({
        name: "SF",
        maxThreads: 4,
        maxHash: 512,
        providerSecret: "secretsecretsecretsecret",
      }),
    ).toThrow();
  });
});

describe("get_external_engine", () => {
  it("GETs /api/external-engine/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "eng1" });

    await findTool("get_external_engine").handler({ id: "eng1" }, makeContext());

    expectFetch(mock, { method: "GET", url: apiUrl("/external-engine/eng1") });
  });
});

describe("update_external_engine", () => {
  it("PUTs JSON to /api/external-engine/{id}", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "eng1" });

    await findTool("update_external_engine").handler(
      {
        id: "eng1",
        name: "Stockfish 16",
        maxThreads: 16,
        maxHash: 4096,
        providerSecret: "secretsecretsecretsecret",
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine/eng1"));
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Stockfish 16");
  });
});

describe("delete_external_engine", () => {
  it("DELETEs /api/external-engine/{id}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("delete_external_engine").handler({ id: "eng1" }, makeContext());

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine/eng1"));
    expect(init.method).toBe("DELETE");
  });
});

describe("analyse_with_external_engine", () => {
  it("POSTs work JSON to /api/external-engine/{id}/analyse", async () => {
    const mock = installFetchMock();
    mock.respondJson({ pvs: [] });

    await findTool("analyse_with_external_engine").handler(
      {
        id: "eng1",
        work: {
          sessionId: "session1",
          threads: 4,
          hash: 256,
          initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          moves: ["e2e4", "e7e5"],
        },
      },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine/eng1/analyse"));
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.sessionId).toBe("session1");
    expect(body.threads).toBe(4);
  });
});

describe("acquire_external_engine_work", () => {
  it("POSTs providerSecret JSON to /api/external-engine/work", async () => {
    const mock = installFetchMock();
    mock.respondJson({ work: null });

    await findTool("acquire_external_engine_work").handler(
      { providerSecret: "secretsecretsecretsecret" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine/work"));
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.providerSecret).toBe("secretsecretsecretsecret");
  });
});

describe("submit_external_engine_work", () => {
  it("POSTs UCI text to /api/external-engine/work/{id}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("submit_external_engine_work").handler(
      { id: "work1", pgn: "info depth 20 score cp 30 pv e2e4" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/external-engine/work/work1"));
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("text/plain");
    expect(init.body).toContain("info depth 20");
  });
});
