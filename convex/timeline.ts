import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store a timeline event ──────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    date: v.optional(v.string()),
    type: v.union(
      v.literal("milestone"),
      v.literal("deadline"),
      v.literal("decision"),
      v.literal("approval"),
      v.literal("dependency")
    ),
    sourceId: v.optional(v.id("sources")),
    confidenceScore: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("timelineEvents", {
      ...args,
      extractedAt: Date.now(),
    });
  },
});

// ─── List timeline events by project ─────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("timelineEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
