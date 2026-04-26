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
