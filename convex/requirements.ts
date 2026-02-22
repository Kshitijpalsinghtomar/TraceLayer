import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Requirement ───────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    requirementId: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("functional"),
      v.literal("non_functional"),
      v.literal("business"),
      v.literal("technical"),
      v.literal("security"),
      v.literal("performance"),
      v.literal("compliance"),
      v.literal("integration")
    ),
    priority: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
    confidenceScore: v.number(),
    sourceId: v.id("sources"),
    sourceExcerpt: v.string(),
    stakeholderIds: v.optional(v.array(v.id("stakeholders"))),
    extractionReasoning: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const reqId = await ctx.db.insert("requirements", {
      projectId: args.projectId,
      requirementId: args.requirementId,
      title: args.title,
      description: args.description,
      category: args.category,
      priority: args.priority,
      status: "discovered",
      confidenceScore: args.confidenceScore,
      sourceId: args.sourceId,
      sourceExcerpt: args.sourceExcerpt,
      stakeholderIds: args.stakeholderIds || [],
      linkedRequirementIds: [],
      linkedDecisionIds: [],
      extractedAt: Date.now(),
      lastModified: Date.now(),
      modifiedBy: "ai",
      extractionReasoning: args.extractionReasoning,
      tags: args.tags || [],
    });

    // Update project count
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await ctx.db.patch(args.projectId, {
        requirementCount: project.requirementCount + 1,
        updatedAt: Date.now(),
      });
    }

    return reqId;
  },
});

// ─── Get Requirements for Project ────────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("requirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ─── Update Requirement ──────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id("requirements"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    status: v.optional(v.union(
      v.literal("discovered"),
      v.literal("pending"),
      v.literal("under_review"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("deferred")
    )),
    category: v.optional(v.union(
      v.literal("functional"),
      v.literal("non_functional"),
      v.literal("business"),
      v.literal("technical"),
      v.literal("security"),
      v.literal("performance"),
      v.literal("compliance"),
      v.literal("integration")
    )),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...filtered, lastModified: Date.now(), modifiedBy: "user" as const });
  },
});

// ─── Get by source ───────────────────────────────────────────────────────────
export const listBySource = query({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("requirements")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
  },
});

// ─── List all requirements (for global search) ──────────────────────────────
export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("requirements")
      .order("desc")
      .take(200);
  },
});
