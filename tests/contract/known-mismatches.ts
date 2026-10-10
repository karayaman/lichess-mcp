export interface KnownMismatch {
  /** Exact string produced by checkRequest (tests/contract/spec-check.ts). */
  mismatch: string;
  reason: string;
}

const group = (reason: string, mismatches: string[]): KnownMismatch[] =>
  mismatches.map((mismatch) => ({ mismatch, reason }));

/**
 * Requests that tool tests send today which don't match the Lichess API spec.
 * Each is a bug to fix or a spec gap. Remove an entry when it's fixed; a full
 * run fails if an entry stops occurring, so this list can only shrink.
 */
export const KNOWN_MISMATCHES: KnownMismatch[] = [
  ...group("Endpoint lives at the site root, not under /api. Confirmed live: the /api path returns 404 and the root path exists.", [
    "GET https://lichess.org/api/broadcast/bid/players API_PREFIX spec path is /broadcast/{broadcastTournamentId}/players",
    "GET https://lichess.org/api/broadcast/bid/players/12345 API_PREFIX spec path is /broadcast/{broadcastTournamentId}/players/{playerId}",
    "GET https://lichess.org/api/broadcast/bid/teams/standings API_PREFIX spec path is /broadcast/{broadcastTournamentId}/teams/standings",
    "POST https://lichess.org/api/broadcast/bid/edit API_PREFIX spec path is /broadcast/{broadcastTournamentId}/edit",
    "POST https://lichess.org/api/broadcast/bid/new API_PREFIX spec path is /broadcast/{broadcastTournamentId}/new",
    "POST https://lichess.org/api/broadcast/new API_PREFIX spec path is /broadcast/new",
    "POST https://lichess.org/api/broadcast/round/rid/edit API_PREFIX spec path is /broadcast/round/{broadcastRoundId}/edit",
    "POST https://lichess.org/api/inbox/a%20b API_PREFIX spec path is /inbox/{username}",
    "POST https://lichess.org/api/inbox/alice API_PREFIX spec path is /inbox/{username}",
    "POST https://lichess.org/api/team/lichess-coders/join API_PREFIX spec path is /team/{teamId}/join",
    "POST https://lichess.org/api/team/lichess-coders/pm-all API_PREFIX spec path is /team/{teamId}/pm-all",
    "POST https://lichess.org/api/team/lichess-coders/quit API_PREFIX spec path is /team/{teamId}/quit",
  ]),
  ...group("Not in the Lichess API spec, so the endpoint probably doesn't exist (simul create/join/withdraw, reading an inbox thread).", [
    "GET https://lichess.org/api/inbox/a%20b UNKNOWN_PATH",
    "GET https://lichess.org/api/inbox/alice UNKNOWN_PATH",
    "POST https://lichess.org/api/simul/mySimul/join UNKNOWN_PATH",
    "POST https://lichess.org/api/simul/mySimul/withdraw UNKNOWN_PATH",
    "POST https://lichess.org/api/simul/new UNKNOWN_PATH",
  ]),
  ...group("GET /api/tv (no channel) is not an API endpoint. Confirmed live: 404.", [
    "GET https://lichess.org/api/tv UNKNOWN_PATH",
  ]),
  ...group("Spec gap: /api/timeline exists (live returns 401 without a token) but isn't in the spec.", [
    "GET https://lichess.org/api/timeline UNKNOWN_PATH",
  ]),
  ...group("External-engine work endpoints are served by engine.lichess.ovh, not lichess.org.", [
    "POST /api/external-engine/{id}/analyse WRONG_HOST spec host is https://engine.lichess.ovh",
    "POST /api/external-engine/work WRONG_HOST spec host is https://engine.lichess.ovh",
    "POST /api/external-engine/work/{id} WRONG_HOST spec host is https://engine.lichess.ovh",
  ]),
  ...group("analyse_with_external_engine sends the work object flat; the spec wants { clientSecret, work: {...} }.", [
    "POST /api/external-engine/{id}/analyse MISSING_FIELD clientSecret",
    "POST /api/external-engine/{id}/analyse MISSING_FIELD work",
    "POST /api/external-engine/{id}/analyse UNKNOWN_FIELD hash",
    "POST /api/external-engine/{id}/analyse UNKNOWN_FIELD initialFen",
    "POST /api/external-engine/{id}/analyse UNKNOWN_FIELD moves",
    "POST /api/external-engine/{id}/analyse UNKNOWN_FIELD sessionId",
    "POST /api/external-engine/{id}/analyse UNKNOWN_FIELD threads",
  ]),
  ...group("Spec wants a form body; the tool sends JSON.", [
    "POST /api/challenge/{challengeId}/decline WRONG_CONTENT_TYPE sent application/json, spec wants application/x-www-form-urlencoded",
    "POST /api/tournament WRONG_CONTENT_TYPE sent application/json, spec wants application/x-www-form-urlencoded",
  ]),
  ...group("Spec requires these fields on every edit; the tool allows partial updates, which Lichess likely rejects.", [
    "POST /api/swiss/{id}/edit MISSING_FIELD clock.increment",
    "POST /api/swiss/{id}/edit MISSING_FIELD clock.limit",
    "POST /api/swiss/{id}/edit MISSING_FIELD nbRounds",
    "POST /api/tournament/{id} MISSING_FIELD clockIncrement",
    "POST /api/tournament/{id} MISSING_FIELD clockTime",
    "POST /api/tournament/{id} MISSING_FIELD minutes",
  ]),
  ...group("Spec takes chapter tags as a pgn field; the tool can only send name.", [
    "POST /api/study/{studyId}/{chapterId}/tags MISSING_FIELD pgn",
    "POST /api/study/{studyId}/{chapterId}/tags UNKNOWN_FIELD name",
  ]),
  ...group("Tablebase dtc is an enum (never/auxiliary/always), not a boolean. Confirmed live: dtc=true returns 400.", [
    "GET /standard BAD_QUERY_VALUE dtc=\"true\" not in [never, auxiliary, always]",
  ]),
  ...group("Value outside the spec's enum. Lichess accepted it live (200), so it may be ignored rather than rejected.", [
    "GET /api/puzzle/batch/{angle} BAD_QUERY_VALUE difficulty=\"medium\" not in [easiest, easier, normal, harder, hardest]",
    "GET /api/puzzle/next BAD_QUERY_VALUE difficulty=\"hard\" not in [easiest, easier, normal, harder, hardest]",
    "GET /api/team/{teamId}/arena BAD_QUERY_VALUE status=\"30\" not in [created, started, finished]",
    "GET /api/team/{teamId}/swiss BAD_QUERY_VALUE status=\"30\" not in [created, started, finished]",
  ]),
  ...group("Query param not in the spec. Unverified whether Lichess honours it.", [
    "GET /api/broadcast/{broadcastTournamentId} UNKNOWN_QUERY clocks",
    "GET /api/broadcast/{broadcastTournamentId} UNKNOWN_QUERY comments",
    "GET /api/team/{teamId}/users UNKNOWN_QUERY max",
  ]),
];
