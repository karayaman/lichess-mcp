import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const teamIdSchema = z.object({
  teamId: z.string().trim().min(1).describe("The team ID"),
});

const getTeamInfo = tool({
  name: "get_team_info",
  description: "Get information about a team",
  schema: teamIdSchema,
  handler: async ({ teamId }, { client }) =>
    client.json(`/team/${encodeURIComponent(teamId)}`),
});

const getTeamMembers = tool({
  name: "get_team_members",
  description: "Get members of a team",
  schema: z.object({
    teamId: z.string().trim().min(1),
    max: z.number().int().min(1).default(100).describe("Maximum number of members to fetch"),
  }),
  handler: async ({ teamId, max }, { client }) =>
    client.ndjson(`/team/${encodeURIComponent(teamId)}/users?max=${max}`),
});

const getTeamJoinRequests = tool({
  name: "get_team_join_requests",
  description: "Get pending join requests for a team",
  schema: teamIdSchema,
  handler: async ({ teamId }, { client }) =>
    client.json(`/team/${encodeURIComponent(teamId)}/requests`),
});

const joinTeam = tool({
  name: "join_team",
  description: "Join a team",
  schema: z.object({
    teamId: z.string().trim().min(1),
    message: z.string().optional().describe("Optional message for team leaders"),
  }),
  handler: async ({ teamId, message }, { client }) => {
    await client.postForm(`/team/${encodeURIComponent(teamId)}/join`, { message });
    return `Successfully joined team ${teamId}`;
  },
});

const leaveTeam = tool({
  name: "leave_team",
  description: "Leave a team",
  schema: teamIdSchema,
  handler: async ({ teamId }, { client }) => {
    await client.post(`/team/${encodeURIComponent(teamId)}/quit`);
    return `Successfully left team ${teamId}`;
  },
});

const kickUserFromTeam = tool({
  name: "kick_user_from_team",
  description: "Kick a user from a team",
  schema: z.object({
    teamId: z.string().trim().min(1),
    userId: z.string().trim().min(1).describe("User ID to kick"),
  }),
  handler: async ({ teamId, userId }, { client }) => {
    await client.post(
      `/team/${encodeURIComponent(teamId)}/kick/${encodeURIComponent(userId)}`,
    );
    return `Successfully kicked user ${userId} from team ${teamId}`;
  },
});

const acceptJoinRequest = tool({
  name: "accept_join_request",
  description: "Accept a join request to a team",
  schema: z.object({
    teamId: z.string().trim().min(1),
    userId: z.string().trim().min(1).describe("User ID whose request to accept"),
  }),
  handler: async ({ teamId, userId }, { client }) => {
    await client.post(
      `/team/${encodeURIComponent(teamId)}/request/${encodeURIComponent(userId)}/accept`,
    );
    return `Successfully accepted join request from user ${userId} to team ${teamId}`;
  },
});

const declineJoinRequest = tool({
  name: "decline_join_request",
  description: "Decline a join request to a team",
  schema: z.object({
    teamId: z.string().trim().min(1),
    userId: z.string().trim().min(1).describe("User ID whose request to decline"),
  }),
  handler: async ({ teamId, userId }, { client }) => {
    await client.post(
      `/team/${encodeURIComponent(teamId)}/request/${encodeURIComponent(userId)}/decline`,
    );
    return `Successfully declined join request from user ${userId} to team ${teamId}`;
  },
});

const searchTeams = tool({
  name: "search_teams",
  description: "Search for teams",
  schema: z.object({
    text: z.string().trim().min(1).describe("Search text"),
    page: z.number().int().min(1).default(1).describe("Page number (starting at 1)"),
  }),
  handler: async ({ text, page }, { client }) => {
    const params = new URLSearchParams({ text, page: String(page) });
    return client.json(`/team/search?${params.toString()}`);
  },
});

const getTeamSwissTournaments = tool({
  name: "get_team_swiss_tournaments",
  description: "Get Swiss tournaments for a team",
  schema: z.object({
    teamId: z.string().trim().min(1).describe("The team ID"),
    max: z.number().int().min(1).optional().describe("Number of tournaments to return"),
    status: z.number().int().optional().describe("Filter by status (10=created, 20=started, 30=finished)"),
  }),
  handler: async ({ teamId, max, status }, { client }) => {
    const params = new URLSearchParams();
    if (max !== undefined) params.set("max", String(max));
    if (status !== undefined) params.set("status", String(status));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.ndjson(`/team/${encodeURIComponent(teamId)}/swiss${qs}`);
  },
});

const getAllTeams = tool({
  name: "get_all_teams",
  description: "Get all public teams (paginated)",
  schema: z.object({
    page: z.number().int().min(1).default(1).describe("Page number"),
  }),
  handler: async ({ page }, { client }) =>
    client.json(`/team/all?page=${page}`),
});

const getTeamsOfUser = tool({
  name: "get_teams_of_user",
  description: "Get all teams that a user is a member of",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the player"),
  }),
  handler: async ({ username }, { client }) =>
    client.json(`/team/of/${encodeURIComponent(username)}`),
});

const getTeamArenaTournaments = tool({
  name: "get_team_arena_tournaments",
  description: "Get arena tournaments for a team",
  schema: z.object({
    teamId: z.string().trim().min(1).describe("The team ID"),
    max: z.number().int().min(1).optional().describe("Number of tournaments to return"),
    status: z.number().int().optional().describe("Filter by status"),
  }),
  handler: async ({ teamId, max, status }, { client }) => {
    const params = new URLSearchParams();
    if (max !== undefined) params.set("max", String(max));
    if (status !== undefined) params.set("status", String(status));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.ndjson(`/team/${encodeURIComponent(teamId)}/arena${qs}`);
  },
});

const pmAllTeamMembers = tool({
  name: "pm_all_team_members",
  description: "Send a private message to all members of a team",
  schema: z.object({
    teamId: z.string().trim().min(1).describe("The team ID"),
    message: z.string().trim().min(1).describe("Message to send"),
  }),
  handler: async ({ teamId, message }, { client }) => {
    await client.postForm(`/team/${encodeURIComponent(teamId)}/pm-all`, { message });
    return `Message sent to all members of team ${teamId}`;
  },
});

export const teamsTools: AnyToolDefinition[] = [
  getTeamInfo,
  getTeamMembers,
  getTeamJoinRequests,
  joinTeam,
  leaveTeam,
  kickUserFromTeam,
  acceptJoinRequest,
  declineJoinRequest,
  searchTeams,
  getTeamSwissTournaments,
  getAllTeams,
  getTeamsOfUser,
  getTeamArenaTournaments,
  pmAllTeamMembers,
];
