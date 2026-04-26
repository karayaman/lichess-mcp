import { LichessApiError } from "./errors.js";
import { parseJson, parseNdjson, parsePgnOrJson } from "./parse.js";
import { TokenStore } from "./token-store.js";

const DEFAULT_BASE_URL = "https://lichess.org/api";
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;

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

    let attempt = 0;
    while (true) {
      const response = await fetch(url, { ...init, headers });
      if (response.ok) return response;

      if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        attempt++;
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt;
        await sleep(backoff);
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
