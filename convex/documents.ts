import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store Document ──────────────────────────────────────────────────────────
export const store = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("brd"), v.literal("prd"), v.literal("traceability_matrix")),
    content: v.string(),
    parentDocumentId: v.optional(v.id("documents")),
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
      parentDocumentId: args.parentDocumentId,
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
    authProviderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Ownership check via parent project
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (args.authProviderId) {
      const project = await ctx.db.get(doc.projectId);
      if (project?.userId) {
        const caller = await ctx.db
          .query("users")
          .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId!))
          .unique();
        if (!caller) throw new Error("Unauthorized");
        if (caller._id !== project.userId && caller.role !== "admin") {
          throw new Error("Unauthorized: you do not own this project");
        }
      }
    }

    await ctx.db.patch(args.documentId, {
      content: args.content,
    });
  },
});

// ─── Get Document Lineage (walk up the parent chain) ─────────────────────────
export const getLineage = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const chain: any[] = [];
    let currentId: string | null = args.documentId;
    const maxDepth = 20; // safety limit
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const docRecord = await ctx.db.get(currentId as any);
      if (!docRecord || docRecord._id === undefined) break;
      chain.unshift(docRecord); // prepend — oldest ancestor first
      // Navigate to parent (documents table has parentDocumentId)
      const asDoc = docRecord as { parentDocumentId?: string | null;[key: string]: any };
      currentId = asDoc.parentDocumentId ?? null;
      depth++;
    }

    return chain;
  },
});

// ─── Get Children Documents ──────────────────────────────────────────────────
export const getChildren = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_parent", (q) => q.eq("parentDocumentId", args.documentId))
      .collect();
  },
});
