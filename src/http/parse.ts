export async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function parseNdjson<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

export async function parsePgnOrJson(
  response: Response,
): Promise<{ kind: "pgn"; pgn: string } | { kind: "json"; data: unknown }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-chess-pgn") || contentType.includes("text/")) {
    return { kind: "pgn", pgn: await response.text() };
  }
  return { kind: "json", data: await response.json() };
}

const DEFAULT_STREAM_TIMEOUT_MS = 10_000;

/**
 * Reads the first non-empty NDJSON line from a streaming response, then cancels
 * the body. Lichess stream endpoints (/stream/event, /tv/feed, game streams)
 * never close, so `response.text()` would wait forever. Blank lines are
 * keep-alives and are skipped. Returns null if the body ends, or the timeout
 * passes, before any data arrives.
 */
export async function readFirstNdjsonLine<T = unknown>(
  response: Response,
  timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
): Promise<T | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const firstLine = async (): Promise<string | null> => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        return buffer.trim() || null;
      }
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) return line;
      }
    }
  };

  try {
    const line = await Promise.race([firstLine(), timeout]);
    return line === null ? null : (JSON.parse(line) as T);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
}
