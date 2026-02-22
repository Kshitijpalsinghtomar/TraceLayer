import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Document ──────────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("brd"), v.literal("prd"), v.literal("traceability_matrix")),
    content: v.string(),
    generatedFrom: v.object({
      requirementCount: v.number(),
      sourceCount: v.number(),
      stakeholderCount: v.number(),
      decisionCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Check for existing doc of this type → increment version
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .collect();

    const version = existing.length + 1;

    // Mark old versions as outdated
    for (const doc of existing) {
      if (doc.status === "ready") {
        await ctx.db.patch(doc._id, { status: "outdated" });
      }
    }

    return await ctx.db.insert("documents", {
      projectId: args.projectId,
      type: args.type,
      version,
      content: args.content,
      generatedAt: Date.now(),
      generatedFrom: args.generatedFrom,
      status: "ready",
    });
  },
});

// ─── Get Latest Document ─────────────────────────────────────────────────────
export const getLatest = query({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("brd"), v.literal("prd"), v.literal("traceability_matrix")),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .order("desc")
      .take(1);
    return docs[0] || null;
  },
});

// ─── List All Documents for Project ──────────────────────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// ─── List all documents (for global search) ──────────────────────────────────
export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("documents")
      .order("desc")
      .take(100);
  },
});

// ─── Update Document Content (for inline editing) ────────────────────────────
export const updateContent = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      content: args.content,
    });
  },
});
