import { LichessApiError } from "./errors.js";
import { parseJson, parseNdjson, parsePgnOrJson, readFirstNdjsonLine } from "./parse.js";
import { TokenStore } from "./token-store.js";

const DEFAULT_BASE_URL = "https://lichess.org/api";
/** For endpoints served from the site root rather than /api (e.g. /team/{id}/join). */
export const SITE_BASE_URL = "https://lichess.org";
/** A 429 waits 10 s, then 20, 40, 80, and gives up once the next wait would pass 3 minutes. */
const RATE_LIMIT_FIRST_WAIT_MS = 10_000;
const RATE_LIMIT_BUDGET_MS = 180_000;
const UNAVAILABLE_RETRIES = 2;
/** A 503 may hide a write Lichess completed, so only these methods are retried on it. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

export interface RequestOptions extends RequestInit {
  /** Set to false to skip the Authorization header (e.g., /token/test). */
  auth?: boolean;
  /** Override the base URL for non-/api endpoints (e.g., /tv, /racer). */
  baseUrl?: string;
}

export type FormFields = Record<string, string | number | boolean | undefined | null>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class LichessClient {
  constructor(
    private readonly tokens: TokenStore,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async request(path: string, options: RequestOptions = {}): Promise<Response> {
    const { auth = true, baseUrl, ...init } = options;
    const headers = new Headers(init.headers);

    if (auth) {
      headers.set("Authorization", `Bearer ${this.tokens.require()}`);
    }

    const url = `${baseUrl ?? this.baseUrl}${path}`;

    const idempotent = IDEMPOTENT_METHODS.has((init.method ?? "GET").toUpperCase());
    let rateLimited = 0;
    let rateLimitWaited = 0;
    let unavailable = 0;
    while (true) {
      const response = await fetch(url, { ...init, headers });
      if (response.ok) return response;

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Math.max(
          RATE_LIMIT_FIRST_WAIT_MS * 2 ** rateLimited,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0,
        );
        if (rateLimitWaited + wait <= RATE_LIMIT_BUDGET_MS) {
          rateLimited++;
          rateLimitWaited += wait;
          await sleep(wait);
          continue;
        }
      }

      if (response.status === 503 && idempotent && unavailable < UNAVAILABLE_RETRIES) {
        unavailable++;
        await sleep(1000 * 2 ** unavailable);
        continue;
      }

      throw await LichessApiError.fromResponse(response);
    }
  }

  json<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request(path, options).then((r) => parseJson<T>(r));
  }

  ndjson<T>(path: string, options?: RequestOptions): Promise<T[]> {
    return this.request(path, options).then((r) => parseNdjson<T>(r));
  }

  /** First event from an endless NDJSON stream; null if none arrives in time. */
  firstStreamEvent<T = unknown>(path: string, options?: RequestOptions): Promise<T | null> {
    return this.request(path, options).then((r) => readFirstNdjsonLine<T>(r));
  }

  pgn(path: string, options?: RequestOptions): Promise<string> {
    const headers = new Headers(options?.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/x-chess-pgn");
    return this.request(path, { ...options, headers }).then((r) => r.text());
  }

  pgnOrJson(path: string, options?: RequestOptions) {
    return this.request(path, options).then(parsePgnOrJson);
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.json<T>(path, { ...options, method: "GET" });
  }

  post(path: string, options?: RequestOptions): Promise<Response> {
    return this.request(path, { ...options, method: "POST" });
  }

  postForm(path: string, fields: FormFields, options: RequestOptions = {}): Promise<Response> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      body.set(key, String(value));
    }
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    return this.request(path, { ...options, method: "POST", headers, body });
  }

  postJson(path: string, body: unknown, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    return this.request(path, {
      ...options,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  postText(
    path: string,
    body: string,
    contentType = "text/plain",
    options: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", contentType);
    return this.request(path, { ...options, method: "POST", headers, body });
  }

  delete(path: string, options?: RequestOptions): Promise<Response> {
    return this.request(path, { ...options, method: "DELETE" });
  }
}
