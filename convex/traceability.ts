import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Traceability Link ─────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    fromType: v.union(
      v.literal("source"),
      v.literal("requirement"),
      v.literal("stakeholder"),
      v.literal("decision"),
      v.literal("conflict"),
      v.literal("timeline")
    ),
    fromId: v.string(),
    toType: v.union(
      v.literal("source"),
      v.literal("requirement"),
      v.literal("stakeholder"),
      v.literal("decision"),
      v.literal("conflict"),
      v.literal("timeline")
    ),
    toId: v.string(),
    relationship: v.string(),
    strength: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("traceabilityLinks", {
      projectId: args.projectId,
      fromType: args.fromType,
      fromId: args.fromId,
      toType: args.toType,
      toId: args.toId,
      relationship: args.relationship,
      strength: args.strength,
      createdAt: Date.now(),
    });
  },
});

// ─── Get full graph for project ──────────────────────────────────────────────
export const getProjectGraph = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("traceabilityLinks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const stakeholders = await ctx.db
      .query("stakeholders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const conflicts = await ctx.db
      .query("conflicts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Build nodes
    const nodes = [
      ...requirements.map((r) => ({
        id: r._id,
        type: "requirement" as const,
        label: r.requirementId + ": " + r.title,
        category: r.category,
        priority: r.priority,
        confidence: r.confidenceScore,
      })),
      ...stakeholders.map((s) => ({
        id: s._id,
        type: "stakeholder" as const,
        label: s.name,
        category: s.influence,
        priority: null,
        confidence: null,
      })),
      ...sources.map((s) => ({
        id: s._id,
        type: "source" as const,
        label: s.name,
        category: s.type,
        priority: null,
        confidence: s.relevanceScore || null,
      })),
      ...decisions.map((d) => ({
        id: d._id,
        type: "decision" as const,
        label: d.decisionId + ": " + d.title,
        category: d.type,
        priority: null,
        confidence: d.confidenceScore,
      })),
      ...conflicts.map((c) => ({
        id: c._id,
        type: "conflict" as const,
        label: c.conflictId + ": " + c.title,
        category: c.severity,
        priority: null,
        confidence: null,
      })),
    ];

    // Build edges
    const edges = links.map((l) => ({
      source: l.fromId,
      target: l.toId,
      relationship: l.relationship,
      strength: l.strength,
    }));

    return { nodes, edges };
  },
});
