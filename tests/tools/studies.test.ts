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

describe("export_study_chapter", () => {
  it("GETs /api/study/{studyId}/{chapterId}.pgn with Accept header", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    const result = await findTool("export_study_chapter").handler(
      { studyId: "studyId", chapterId: "chapId" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/study/studyId/chapId.pgn");
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
    expect(String(result)).toContain("[Event ?]");
  });

  it("includes optional flags", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("export_study_chapter").handler(
      { studyId: "sid", chapterId: "cid", clocks: true, comments: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("clocks=true");
    expect(url).toContain("comments=true");
  });
});

describe("export_all_study_chapters", () => {
  it("GETs /api/study/{studyId}.pgn", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    await findTool("export_all_study_chapters").handler({ studyId: "studyId" }, makeContext());

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/study/studyId.pgn");
  });

  it("includes flags when provided", async () => {
    const mock = installFetchMock();
    mock.respondPgn("");

    await findTool("export_all_study_chapters").handler(
      { studyId: "sid", clocks: true, comments: true },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("clocks=true");
    expect(url).toContain("comments=true");
  });
});

describe("get_user_studies", () => {
  it("GETs /api/study/by/{username} as ndjson", async () => {
    const mock = installFetchMock();
    mock.respondNdjson([{ id: "study1" }]);

    const result = await findTool("get_user_studies").handler(
      { username: "alice" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toContain("/study/by/alice");
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("create_study", () => {
  it("POSTs form data to /api/study", async () => {
    const mock = installFetchMock();
    mock.respondJson({ id: "newStudy" });

    await findTool("create_study").handler(
      { name: "My Study", visibility: "public" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/study"));
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("name=My+Study");
    expect(init.body?.toString()).toContain("visibility=public");
  });

  it("rejects name shorter than 2 chars (schema validation)", () => {
    expect(() => findTool("create_study").schema.parse({ name: "X" })).toThrow();
  });
});

describe("import_study_pgn", () => {
  it("POSTs PGN to /api/study/{studyId}/import-pgn", async () => {
    const mock = installFetchMock();
    mock.respondJson({ chapters: [] });

    await findTool("import_study_pgn").handler(
      { studyId: "studyId", pgn: "[Event ?]\n1. e4" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/study/studyId/import-pgn"));
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("pgn=");
  });
});

describe("update_study_chapter_tags", () => {
  it("POSTs to /api/study/{studyId}/{chapterId}/tags", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("update_study_chapter_tags").handler(
      { studyId: "sid", chapterId: "cid", name: "My Chapter" },
      makeContext(),
    );

    const [url] = mock.mock.calls[0] as [string, unknown];
    expect(url).toBe(apiUrl("/study/sid/cid/tags"));
  });
});

describe("add_study_chapter_moves", () => {
  it("POSTs pgn to /api/study/{studyId}/{chapterId}/moves", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("add_study_chapter_moves").handler(
      { studyId: "sid", chapterId: "cid", pgn: "1. e4 e5" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/study/sid/cid/moves"));
    expect(init.body?.toString()).toContain("pgn=");
  });
});

describe("export_user_studies_pgn", () => {
  it("GETs /api/study/by/{username}/export.pgn with Accept header", async () => {
    const mock = installFetchMock();
    mock.respondPgn("[Event ?]");

    const result = await findTool("export_user_studies_pgn").handler(
      { username: "alice" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toContain("/study/by/alice/export.pgn");
    expect(init.headers.get("Accept")).toBe("application/x-chess-pgn");
    expect(String(result)).toContain("[Event ?]");
  });
});

describe("delete_study_chapter", () => {
  it("DELETEs /api/study/{studyId}/{chapterId}", async () => {
    const mock = installFetchMock();
    mock.respondStatus(200);

    await findTool("delete_study_chapter").handler(
      { studyId: "sid", chapterId: "cid" },
      makeContext(),
    );

    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe(apiUrl("/study/sid/cid"));
    expect(init.method).toBe("DELETE");
  });
});
