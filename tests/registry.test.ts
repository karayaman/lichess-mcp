import { describe, it, expect } from "vitest";
import { z } from "zod";
import { allTools } from "../src/tools/index.js";

describe("tool registry", () => {
  it("has at least one tool", () => {
    expect(allTools.length).toBeGreaterThan(0);
  });

  it("every tool has a unique name", () => {
    const names = allTools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("every tool has a non-empty description", () => {
    for (const t of allTools) {
      expect(t.description, `${t.name} has empty description`).toBeTruthy();
    }
  });

  it("every tool schema is a ZodObject", () => {
    for (const t of allTools) {
      expect(t.schema, `${t.name} schema is not a ZodObject`).toBeInstanceOf(z.ZodObject);
    }
  });

  it("every tool handler is a function", () => {
    for (const t of allTools) {
      expect(typeof t.handler, `${t.name} handler is not a function`).toBe("function");
    }
  });

  it("iframe-bearing ui descriptors point at known htmlFile names with ui:// resourceUris", () => {
    const iframeTools = allTools.filter((t) => t.ui?.resourceUri);
    expect(iframeTools.length).toBeGreaterThan(0);
    for (const t of iframeTools) {
      expect(t.ui!.resourceUri!.startsWith("ui://"), `${t.name} resourceUri must start with ui://`).toBe(true);
      expect(t.ui!.htmlFile, `${t.name} with resourceUri must also set htmlFile`).toBeTruthy();
      expect(t.ui!.htmlFile!.endsWith(".html"), `${t.name} htmlFile must end with .html`).toBe(true);
    }
  });

  it("ui visibility entries are 'model' or 'app', and at least one tool is app-only", () => {
    const visibilityTools = allTools.filter((t) => t.ui?.visibility);
    for (const t of visibilityTools) {
      for (const v of t.ui!.visibility!) {
        expect(["model", "app"], `${t.name} has invalid visibility ${v}`).toContain(v);
      }
    }
    const appOnly = allTools.filter(
      (t) => t.ui?.visibility?.length === 1 && t.ui.visibility[0] === "app",
    );
    expect(
      appOnly.length,
      "expected at least one app-only tool (e.g. submit_puzzle_batch) — visibility:['app'] guards iframe-only writes",
    ).toBeGreaterThan(0);
  });
});
