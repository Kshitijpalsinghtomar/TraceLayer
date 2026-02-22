import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Decision ──────────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    decisionId: v.string(),
    title: v.string(),
    description: v.string(),
    type: v.string(), // flexible — AI may produce varied categories
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("deferred")
    ),
    madeBy: v.optional(v.id("stakeholders")),
    sourceId: v.id("sources"),
    sourceExcerpt: v.string(),
    confidenceScore: v.number(),
    impactedRequirementIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("decisions", {
      projectId: args.projectId,
      decisionId: args.decisionId,
      title: args.title,
      description: args.description,
      type: args.type,
      status: args.status,
      madeBy: args.madeBy,
      sourceId: args.sourceId,
      sourceExcerpt: args.sourceExcerpt,
      confidenceScore: args.confidenceScore,
      impactedRequirementIds: args.impactedRequirementIds || [],
      extractedAt: Date.now(),
    });

    const project = await ctx.db.get(args.projectId);
    if (project) {
      await ctx.db.patch(args.projectId, {
        decisionCount: project.decisionCount + 1,
        updatedAt: Date.now(),
      });
    }

    return id;
  },
});

// ─── List by Project ─────────────────────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
