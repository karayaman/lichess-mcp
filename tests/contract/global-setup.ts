import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { KNOWN_MISMATCHES } from "./known-mismatches.js";

declare module "vitest" {
  export interface ProvidedContext {
    contractDir: string;
  }
}

/**
 * Gives each test worker a shared directory to report which known mismatches
 * it hit. After a full run, any entry in KNOWN_MISMATCHES that no test hit is
 * stale (probably fixed) and fails the run, so the list can only shrink.
 */
export default function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "lichess-contract-"));
  project.provide("contractDir", dir);

  return () => {
    try {
      const reports = readdirSync(dir).flatMap((f) =>
        readFileSync(join(dir, f), "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { file: string; hit: string[] }),
      );
      // Only judge staleness when every tool test file ran, not on a filtered run.
      const toolFiles = readdirSync(new URL("../tools", import.meta.url), { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".test.ts"));
      const ranFiles = new Set(reports.map((r) => r.file));
      if (ranFiles.size < toolFiles.length) return;

      const hit = new Set(reports.flatMap((r) => r.hit));
      const stale = KNOWN_MISMATCHES.filter((m) => !hit.has(m.mismatch));
      if (stale.length > 0) {
        throw new Error(
          "These entries in tests/contract/known-mismatches.ts no longer occur. " +
            "Remove them:\n" +
            stale.map((m) => `  ${m.mismatch}`).join("\n"),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
