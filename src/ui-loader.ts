import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Resolves a Vite-bundled iframe HTML file (`build/ui/<htmlFile>`) sitting
 * next to the compiled server entry. Cached at boot — the file is small but
 * the resource handler can fire on every tool invocation.
 */
const cache = new Map<string, string>();

const here = dirname(fileURLToPath(import.meta.url));

export function readUiHtml(htmlFile: string): string {
  let html = cache.get(htmlFile);
  if (html === undefined) {
    html = readFileSync(resolve(here, "ui", htmlFile), "utf-8");
    cache.set(htmlFile, html);
  }
  return html;
}
