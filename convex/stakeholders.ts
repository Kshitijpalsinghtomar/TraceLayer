import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Stakeholder ───────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    role: v.string(),
    department: v.optional(v.string()),
    influence: v.union(
      v.literal("decision_maker"),
      v.literal("influencer"),
      v.literal("contributor"),
      v.literal("observer")
    ),
    sentiment: v.optional(v.union(
      v.literal("supportive"),
      v.literal("neutral"),
      v.literal("resistant"),
      v.literal("unknown")
    )),
    sourceIds: v.array(v.id("sources")),
  },
  handler: async (ctx, args) => {
    // Check if stakeholder already exists (by name + project)
    const existing = await ctx.db
      .query("stakeholders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const match = existing.find(
      (s) => s.name.toLowerCase() === args.name.toLowerCase()
    );

    if (match) {
      // Update existing stakeholder
      const newSourceIds = [...new Set([...match.sourceIds, ...args.sourceIds])];
      await ctx.db.patch(match._id, {
        mentionCount: match.mentionCount + 1,
        sourceIds: newSourceIds,
        role: args.role || match.role,
        influence: args.influence || match.influence,
      });
      return match._id;
    }

    const id = await ctx.db.insert("stakeholders", {
      projectId: args.projectId,
      name: args.name,
      role: args.role,
      department: args.department,
      influence: args.influence,
      sentiment: args.sentiment || "unknown",
      mentionCount: 1,
      sourceIds: args.sourceIds,
      relatedStakeholderIds: [],
      extractedAt: Date.now(),
    });

    // Update project count
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await ctx.db.patch(args.projectId, {
        stakeholderCount: project.stakeholderCount + 1,
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
      .query("stakeholders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
