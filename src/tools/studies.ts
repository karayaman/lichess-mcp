import { z } from "zod";
import { AnyToolDefinition, tool } from "../registry.js";

const studyFlags = {
  clocks: z.boolean().optional(),
  comments: z.boolean().optional(),
  variations: z.boolean().optional(),
  source: z.boolean().optional(),
  orientation: z.boolean().optional(),
};

const exportStudyChapter = tool({
  name: "export_study_chapter",
  description: "Export one study chapter as PGN",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    chapterId: z.string().trim().min(1).describe("The chapter ID"),
    ...studyFlags,
  }),
  handler: async ({ studyId, chapterId, ...flags }, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(flags)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.pgn(
      `/study/${encodeURIComponent(studyId)}/${encodeURIComponent(chapterId)}.pgn${qs}`,
    );
  },
});

const exportAllStudyChapters = tool({
  name: "export_all_study_chapters",
  description: "Export all chapters of a study as PGN",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    ...studyFlags,
  }),
  handler: async ({ studyId, ...flags }, { client }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(flags)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return client.pgn(`/study/${encodeURIComponent(studyId)}.pgn${qs}`);
  },
});

const getUserStudies = tool({
  name: "get_user_studies",
  description: "Get studies created by a user",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the study creator"),
  }),
  handler: async ({ username }, { client }) =>
    client.ndjson(`/study/by/${encodeURIComponent(username)}`),
});

const studyPermission = z
  .enum(["nobody", "owner", "contributor", "member", "everyone"])
  .optional()
  .default("everyone");

const createStudy = tool({
  name: "create_study",
  description: "Create a new study",
  schema: z.object({
    name: z.string().trim().min(2).max(100).describe("The study name"),
    visibility: z
      .enum(["public", "unlisted", "private"])
      .optional()
      .default("unlisted")
      .describe("Who can view the study"),
    explorer: studyPermission.describe("Who can use the opening explorer"),
    computer: studyPermission.describe("Who can use computer analysis"),
    chat: studyPermission.describe("Who can chat"),
    shareable: studyPermission.describe("Who can share and export"),
    cloneable: studyPermission.describe("Who can clone the study"),
  }),
  handler: async ({ name, visibility, ...settings }, { client }) => {
    const response = await client.postForm("/study", {
      name,
      visibility,
      ...settings,
    });
    return (await response.json()) as object;
  },
});

const importStudyPgn = tool({
  name: "import_study_pgn",
  description: "Import a PGN into a study as new chapters",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    pgn: z.string().trim().min(1).describe("PGN content to import"),
  }),
  handler: async ({ studyId, pgn }, { client }) => {
    const response = await client.postForm(
      `/study/${encodeURIComponent(studyId)}/import-pgn`,
      { pgn },
    );
    return (await response.json()) as object;
  },
});

const updateStudyChapterTags = tool({
  name: "update_study_chapter_tags",
  description: "Update tags for a study chapter",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    chapterId: z.string().trim().min(1).describe("The chapter ID"),
    name: z.string().optional().describe("Chapter name"),
  }),
  handler: async ({ studyId, chapterId, ...tags }, { client }) => {
    await client.postForm(
      `/study/${encodeURIComponent(studyId)}/${encodeURIComponent(chapterId)}/tags`,
      tags,
    );
    return `Tags updated for chapter ${chapterId} of study ${studyId}`;
  },
});

const addStudyChapterMoves = tool({
  name: "add_study_chapter_moves",
  description: "Add moves to a study chapter",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    chapterId: z.string().trim().min(1).describe("The chapter ID"),
    pgn: z.string().trim().min(1).describe("PGN of the moves to add"),
  }),
  handler: async ({ studyId, chapterId, pgn }, { client }) => {
    await client.postForm(
      `/study/${encodeURIComponent(studyId)}/${encodeURIComponent(chapterId)}/moves`,
      { pgn },
    );
    return `Moves added to chapter ${chapterId} of study ${studyId}`;
  },
});

const exportUserStudiesPgn = tool({
  name: "export_user_studies_pgn",
  description: "Export all chapters of all studies by a user as PGN",
  schema: z.object({
    username: z.string().trim().min(1).describe("Username of the study creator"),
  }),
  handler: async ({ username }, { client }) =>
    client.pgn(`/study/by/${encodeURIComponent(username)}/export.pgn`),
});

const deleteStudyChapter = tool({
  name: "delete_study_chapter",
  description: "Delete a chapter from a study",
  schema: z.object({
    studyId: z.string().trim().min(1).describe("The study ID"),
    chapterId: z.string().trim().min(1).describe("The chapter ID to delete"),
  }),
  handler: async ({ studyId, chapterId }, { client }) => {
    await client.delete(
      `/study/${encodeURIComponent(studyId)}/${encodeURIComponent(chapterId)}`,
    );
    return `Chapter ${chapterId} deleted from study ${studyId}`;
  },
});

export const studiesTools: AnyToolDefinition[] = [
  exportStudyChapter,
  exportAllStudyChapters,
  getUserStudies,
  createStudy,
  importStudyPgn,
  updateStudyChapterTags,
  addStudyChapterMoves,
  exportUserStudiesPgn,
  deleteStudyChapter,
];
