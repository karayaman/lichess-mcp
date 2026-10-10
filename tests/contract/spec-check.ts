/**
 * Checks an outgoing request against a trimmed Lichess OpenAPI spec
 * (tests/contract/lichess-api.json, produced by scripts/update-lichess-spec.mjs).
 *
 * Returns one string per mismatch, shaped "<METHOD> <path> <KIND>[ <detail>]",
 * where <path> is the spec's path template when one matched, else the raw path.
 */

export interface SpecSchema {
  type?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SpecSchema>;
}

export interface SpecParam {
  name: string;
  in: string;
  required?: boolean;
  schema?: SpecSchema;
}

export interface SpecOperation {
  servers?: string[];
  parameters?: SpecParam[];
  requestBody?: { required?: boolean; content: Record<string, SpecSchema> };
}

export interface Spec {
  servers: string[];
  paths: Record<string, Record<string, unknown> & { servers?: string[]; parameters?: SpecParam[] }>;
}

export interface CapturedRequest {
  url: string;
  method: string;
  contentType: string | null;
  body: string | null;
}

const METHODS = ["get", "post", "put", "delete", "patch"];

interface CompiledOp {
  host: string;
  regex: RegExp;
  template: string;
  method: string;
  op: SpecOperation;
  params: SpecParam[];
}

const compiled = new WeakMap<Spec, CompiledOp[]>();

function compile(spec: Spec): CompiledOp[] {
  const cached = compiled.get(spec);
  if (cached) return cached;
  const ops: CompiledOp[] = [];
  for (const [template, item] of Object.entries(spec.paths)) {
    const pattern = template
      .split(/\{[^}]+\}/)
      .map((part) => part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"))
      .join("[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    for (const method of METHODS) {
      const op = item[method] as SpecOperation | undefined;
      if (!op) continue;
      const servers = op.servers ?? item.servers;
      ops.push({
        host: servers?.[0] ?? spec.servers[0],
        regex,
        template,
        method: method.toUpperCase(),
        op,
        params: [...(item.parameters ?? []), ...(op.parameters ?? [])],
      });
    }
  }
  compiled.set(spec, ops);
  return ops;
}

function checkValue(name: string, value: string, schema: SpecSchema | undefined): string | null {
  if (!schema) return null;
  if (schema.enum && !schema.enum.map(String).includes(value)) {
    return `${name}=${JSON.stringify(value)} not in [${schema.enum.join(", ")}]`;
  }
  switch (schema.type) {
    case "boolean":
      return value === "true" || value === "false" ? null : `${name}=${JSON.stringify(value)} is not a boolean`;
    case "integer":
      return /^-?\d+$/.test(value) ? null : `${name}=${JSON.stringify(value)} is not an integer`;
    case "number":
      return /^-?\d+(\.\d+)?$/.test(value) ? null : `${name}=${JSON.stringify(value)} is not a number`;
    default:
      return null;
  }
}

function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim();
}

function parseBody(body: string, contentType: string | null): Record<string, unknown> | null {
  const type = mediaType(contentType);
  if (type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(body));
  }
  if (type === "application/json") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function checkRequest(request: CapturedRequest, spec: Spec): string[] {
  const url = new URL(request.url);
  const host = url.origin;
  const method = request.method.toUpperCase();
  const ops = compile(spec);

  const byPath = ops.filter((o) => o.regex.test(url.pathname));
  if (byPath.length === 0) return [`${method} ${host}${url.pathname} UNKNOWN_PATH`];

  const byMethod = byPath
    .filter((o) => o.method === method)
    // Prefer the most literal template, e.g. /broadcast/new over /broadcast/{id}.
    .sort((a, b) => a.template.split("{").length - b.template.split("{").length);
  if (byMethod.length === 0) {
    const allowed = [...new Set(byPath.map((o) => o.method))].sort().join(", ");
    return [`${method} ${host}${url.pathname} WRONG_METHOD spec allows ${allowed}`];
  }

  const issues: string[] = [];
  const match = byMethod.find((o) => o.host === host) ?? byMethod[0];
  const key = `${method} ${match.template}`;
  if (match.host !== host) issues.push(`${key} WRONG_HOST spec host is ${match.host}`);

  const querySpec = new Map(match.params.filter((p) => p.in === "query").map((p) => [p.name, p]));
  const query = new URLSearchParams(url.search);
  for (const [name, value] of query) {
    const param = querySpec.get(name);
    if (!param) {
      issues.push(`${key} UNKNOWN_QUERY ${name}`);
      continue;
    }
    const problem = checkValue(name, value, param.schema);
    if (problem) issues.push(`${key} BAD_QUERY_VALUE ${problem}`);
  }
  for (const [name, param] of querySpec) {
    if (param.required && !query.has(name)) issues.push(`${key} MISSING_QUERY ${name}`);
  }

  const requestBody = match.op.requestBody;
  if (request.body === null || request.body === "") {
    if (requestBody?.required) issues.push(`${key} MISSING_BODY`);
    return issues;
  }
  if (!requestBody) {
    issues.push(`${key} UNEXPECTED_BODY`);
    return issues;
  }
  const sent = mediaType(request.contentType);
  const schema = requestBody.content[sent];
  if (!schema) {
    const expected = Object.keys(requestBody.content).join(", ");
    issues.push(`${key} WRONG_CONTENT_TYPE sent ${sent || "none"}, spec wants ${expected}`);
    return issues;
  }
  const fields = parseBody(request.body, request.contentType);
  if (!fields || !schema.properties) return issues;
  for (const [name, value] of Object.entries(fields)) {
    const prop = schema.properties[name] ?? schema.properties[name.replace(/\[.*\]$/, "")];
    if (!prop) {
      issues.push(`${key} UNKNOWN_FIELD ${name}`);
      continue;
    }
    if (typeof value === "string") {
      const problem = checkValue(name, value, prop);
      if (problem) issues.push(`${key} BAD_FIELD_VALUE ${problem}`);
    }
  }
  for (const name of schema.required ?? []) {
    if (!(name in fields)) issues.push(`${key} MISSING_FIELD ${name}`);
  }
  return issues;
}
