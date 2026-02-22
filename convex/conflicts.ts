import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Conflict ──────────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    conflictId: v.string(),
    title: v.string(),
    description: v.string(),
    severity: v.union(v.literal("critical"), v.literal("major"), v.literal("minor")),
    requirementIds: v.array(v.id("requirements")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("conflicts", {
      projectId: args.projectId,
      conflictId: args.conflictId,
      title: args.title,
      description: args.description,
      severity: args.severity,
      status: "detected",
      requirementIds: args.requirementIds,
      detectedAt: Date.now(),
    });

    const project = await ctx.db.get(args.projectId);
    if (project) {
      await ctx.db.patch(args.projectId, {
        conflictCount: project.conflictCount + 1,
        updatedAt: Date.now(),
      });
    }

    return id;
  },
});

// ─── List by Project ────────────────────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conflicts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ─── Resolve Conflict ────────────────────────────────────────────────────────
export const resolve = mutation({
  args: {
    conflictId: v.id("conflicts"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conflictId, {
      status: "resolved",
      resolution: args.resolution,
    });
  },
});
