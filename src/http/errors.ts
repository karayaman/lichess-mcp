const STATUS_MESSAGES: Record<number, string> = {
  400: "Bad request to Lichess",
  401: "Unauthorized — token is missing or invalid",
  403: "Forbidden — your token lacks the required scope",
  404: "Not found",
  409: "Conflict — resource is in an incompatible state",
  429: "Rate limited by Lichess",
  500: "Lichess server error",
  503: "Lichess service unavailable",
};

export class LichessApiError extends Error {
  readonly status: number;

  constructor(status: number, detail?: string) {
    super(detail ?? STATUS_MESSAGES[status] ?? `HTTP ${status}`);
    this.name = "LichessApiError";
    this.status = status;
  }

  static async fromResponse(response: Response): Promise<LichessApiError> {
    const body = await response.text().catch(() => "");
    let detail = STATUS_MESSAGES[response.status] ?? response.statusText;
    if (body) {
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string };
        if (parsed.error) detail = parsed.error;
        else if (parsed.message) detail = parsed.message;
      } catch {
        // Body wasn't JSON; keep the default detail.
      }
    }
    return new LichessApiError(response.status, detail);
  }
}
