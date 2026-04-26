/** Response types used in tool handler logic (not exhaustive Lichess API types). */

export interface ChallengeResponse {
  challenge: {
    id: string;
    url: string;
  };
}
