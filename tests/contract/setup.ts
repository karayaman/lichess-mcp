import { afterEach, expect, inject, vi } from "vitest";
import { appendFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checkRequest, type Spec } from "./spec-check.js";
import { KNOWN_MISMATCHES } from "./known-mismatches.js";
const spec = JSON.parse(readFileSync(join(__dirname, "lichess-api.json"), "utf8")) as Spec;
const known = new Set(KNOWN_MISMATCHES.map((m) => m.mismatch));

/**
 * Contract check: after each tool test, every request the tool sent through
 * the mocked fetch is checked against the Lichess OpenAPI spec. A mismatch
 * that isn't listed in known-mismatches.ts fails the test.
 */
afterEach(() => {
  const testPath = expect.getState().testPath ?? "";
  if (!testPath.includes("/tests/tools/")) return;

  const hit = new Set<string>();
  const unexpected: string[] = [];
  const fetchMock = globalThis.fetch as unknown;
  if (vi.isMockFunction(fetchMock)) {
    for (const [url, init = {}] of fetchMock.mock.calls as [string, RequestInit | undefined][]) {
      const request = {
        url: String(url),
        method: init.method ?? "GET",
        contentType: new Headers(init.headers).get("content-type"),
        body: init.body == null ? null : String(init.body),
      };
      for (const mismatch of checkRequest(request, spec)) {
        if (known.has(mismatch)) hit.add(mismatch);
        else unexpected.push(mismatch);
      }
    }
  }

  const file = relative(join(__dirname, "../tools"), testPath);
  appendFileSync(
    join(inject("contractDir"), `${process.pid}.ndjson`),
    JSON.stringify({ file, hit: [...hit] }) + "\n",
  );

  if (unexpected.length > 0) {
    throw new Error(
      "Request doesn't match the Lichess API spec (tests/contract/lichess-api.json):\n" +
        unexpected.map((m) => `  ${m}`).join("\n") +
        "\nFix the request, or if the spec is wrong, add it to tests/contract/known-mismatches.ts with a reason.",
    );
  }
});
