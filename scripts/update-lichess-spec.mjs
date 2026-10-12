#!/usr/bin/env node
// Refreshes tests/contract/lichess-api.json, the trimmed Lichess OpenAPI spec
// the contract test checks requests against.
//
// Usage: node scripts/update-lichess-spec.mjs [commit-sha]   (default: master)
//
// Downloads lichess-org/api at the given commit, bundles the multi-file spec
// with Redocly (fetched by npx; not a project dependency), and keeps only
// what the contract test reads: servers, paths, methods, parameters, and
// request-body content types and property names/types/enums.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REDOCLY = "@redocly/cli@2.53.3";
const OUT = new URL("../tests/contract/lichess-api.json", import.meta.url);

const ref = process.argv[2] ?? "master";
const sha = execFileSync(
  "gh",
  ["api", `repos/lichess-org/api/commits/${ref}`, "-q", ".sha"],
  { encoding: "utf8" },
).trim();

const dir = mkdtempSync(join(tmpdir(), "lichess-spec-"));
try {
  const tarball = join(dir, "spec.tgz");
  execFileSync("sh", ["-c", `gh api repos/lichess-org/api/tarball/${sha} > "${tarball}"`]);
  execFileSync("tar", ["xzf", tarball, "-C", dir, "--strip-components=1"]);
  const bundled = join(dir, "bundled.json");
  execFileSync(
    "npx",
    ["-y", REDOCLY, "bundle", join(dir, "doc/specs/lichess-api.yaml"), "--dereferenced", "--ext", "json", "-o", bundled],
    { stdio: "inherit" },
  );
  const spec = JSON.parse(readFileSync(bundled, "utf8"));
  writeFileSync(OUT, JSON.stringify(trim(spec, sha), null, 1) + "\n");
  console.log(`wrote ${OUT.pathname} from lichess-org/api@${sha}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

function trimSchema(s) {
  if (!s || typeof s !== "object") return undefined;
  const out = {};
  if (s.type) out.type = s.type;
  if (s.enum) out.enum = s.enum;
  if (s.required) out.required = s.required;
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, trimSchema(v) ?? {}]),
    );
  }
  return Object.keys(out).length ? out : undefined;
}

function trimParams(params = []) {
  return params.map((p) => ({
    name: p.name,
    in: p.in,
    ...(p.required ? { required: true } : {}),
    ...(trimSchema(p.schema) ? { schema: trimSchema(p.schema) } : {}),
  }));
}

function trim(spec, sha) {
  const paths = {};
  for (const [path, item] of Object.entries(spec.paths)) {
    const outItem = {};
    if (item.servers) outItem.servers = item.servers.map((s) => s.url);
    if (item.parameters) outItem.parameters = trimParams(item.parameters);
    for (const method of ["get", "post", "put", "delete", "patch"]) {
      const op = item[method];
      if (!op) continue;
      const outOp = {};
      if (op.servers) outOp.servers = op.servers.map((s) => s.url);
      if (op.parameters) outOp.parameters = trimParams(op.parameters);
      if (op.requestBody) {
        outOp.requestBody = {
          ...(op.requestBody.required ? { required: true } : {}),
          content: Object.fromEntries(
            Object.entries(op.requestBody.content ?? {}).map(([type, c]) => [
              type,
              trimSchema(c.schema) ?? {},
            ]),
          ),
        };
      }
      outItem[method] = outOp;
    }
    paths[path] = outItem;
  }
  return {
    source: `https://github.com/lichess-org/api/tree/${sha}/doc/specs/lichess-api.yaml`,
    servers: spec.servers.map((s) => s.url),
    paths,
  };
}
