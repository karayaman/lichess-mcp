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
});
