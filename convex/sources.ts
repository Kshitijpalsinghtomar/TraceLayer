import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Upload Source ───────────────────────────────────────────────────────────
export const upload = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    type: v.union(
      v.literal("email"),
      v.literal("meeting_transcript"),
      v.literal("chat_log"),
      v.literal("document"),
      v.literal("uploaded_file")
    ),
    content: v.string(),
    metadata: v.optional(v.object({
      author: v.optional(v.string()),
      date: v.optional(v.string()),
      channel: v.optional(v.string()),
      subject: v.optional(v.string()),
      participants: v.optional(v.array(v.string())),
      wordCount: v.optional(v.number()),
      integrationAppId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const wordCount = args.content.split(/\s+/).length;

    const sourceId = await ctx.db.insert("sources", {
      projectId: args.projectId,
      name: args.name,
      type: args.type,
      content: args.content,
      rawContent: "",
      metadata: {
        ...args.metadata,
        wordCount,
      },
      status: "uploaded",
      createdAt: Date.now(),
    });

    // Update project source count
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await ctx.db.patch(args.projectId, {
        sourceCount: project.sourceCount + 1,
        updatedAt: Date.now(),
      });
    }

    return sourceId;
  },
});

// ─── Get Sources for Project ─────────────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ─── Update Source Status ────────────────────────────────────────────────────
export const updateStatus = mutation({
  args: {
    sourceId: v.id("sources"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("classifying"),
      v.literal("classified"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("failed")
    ),
    relevanceScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.relevanceScore !== undefined) {
      updates.relevanceScore = args.relevanceScore;
    }
    await ctx.db.patch(args.sourceId, updates);
  },
});

// ─── Get single source ───────────────────────────────────────────────────────
export const get = query({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceId);
  },
});
