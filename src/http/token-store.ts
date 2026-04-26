export class TokenStore {
  private value: string | undefined;

  constructor(initial: string | undefined = process.env.LICHESS_TOKEN) {
    this.value = initial;
  }

  get(): string | undefined {
    return this.value;
  }

  set(token: string): void {
    this.value = token;
  }

  clear(): void {
    this.value = undefined;
  }

  require(): string {
    if (!this.value) {
      throw new LichessTokenMissingError();
    }
    return this.value;
  }
}

export class LichessTokenMissingError extends Error {
  constructor() {
    super("Lichess API token not set. Use the set_token tool first.");
    this.name = "LichessTokenMissingError";
  }
}
