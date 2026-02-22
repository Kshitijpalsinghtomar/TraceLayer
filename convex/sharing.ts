import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Generate a unique share token ───────────────────────────────────────────
function generateToken(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// ─── Create a share link ─────────────────────────────────────────────────────
export const createLink = mutation({
    args: {
        projectId: v.id("projects"),
        permission: v.union(v.literal("view"), v.literal("comment"), v.literal("edit")),
        password: v.optional(v.string()),
        expiresInDays: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const token = generateToken();
        const expiresAt = args.expiresInDays
            ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
            : undefined;

        const id = await ctx.db.insert("sharedLinks", {
            projectId: args.projectId,
            token,
            permission: args.permission,
            password: args.password || undefined,
            expiresAt,
            isActive: true,
            createdAt: Date.now(),
            accessCount: 0,
        });

        return { id, token };
    },
});

// ─── List share links for a project ──────────────────────────────────────────
export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("sharedLinks")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();
    },
});

// ─── Revoke (deactivate) a share link ────────────────────────────────────────
export const revokeLink = mutation({
    args: { linkId: v.id("sharedLinks") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.linkId, { isActive: false });
    },
});

// ─── Delete a share link ─────────────────────────────────────────────────────
export const deleteLink = mutation({
    args: { linkId: v.id("sharedLinks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.linkId);
    },
});

// ─── Update permission on a share link ───────────────────────────────────────
export const updatePermission = mutation({
    args: {
        linkId: v.id("sharedLinks"),
        permission: v.union(v.literal("view"), v.literal("comment"), v.literal("edit")),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.linkId, { permission: args.permission });
    },
});

// ─── Get shared BRD data by token (public access) ────────────────────────────
export const getByToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const link = await ctx.db
            .query("sharedLinks")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!link || !link.isActive) {
            return { error: "not_found" as const };
        }

        // Check expiration
        if (link.expiresAt && Date.now() > link.expiresAt) {
            return { error: "expired" as const };
        }

        // Fetch project data
        const project = await ctx.db.get(link.projectId);
        if (!project) {
            return { error: "not_found" as const };
        }

        // Fetch BRD document
        const docs = await ctx.db
            .query("documents")
            .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
            .filter((q) => q.eq(q.field("type"), "brd"))
            .collect();

        // Get latest version
        const latestDoc = docs.sort((a, b) => (b.version || 0) - (a.version || 0))[0];

        // Fetch requirements
        const requirements = await ctx.db
            .query("requirements")
            .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
            .collect();

        // Fetch stakeholders
        const stakeholders = await ctx.db
            .query("stakeholders")
            .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
            .collect();

        // Fetch conflicts
        const conflicts = await ctx.db
            .query("conflicts")
            .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
            .collect();

        // Fetch sources (metadata only, not content)
        const sources = await ctx.db
            .query("sources")
            .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
            .collect();

        const sourceMeta = sources.map((s) => ({
            _id: s._id,
            name: s.name,
            type: s.type,
            relevanceScore: s.relevanceScore,
            metadata: s.metadata,
        }));

        return {
            error: null,
            permission: link.permission,
            hasPassword: !!link.password,
            project: { name: project.name, description: project.description },
            brdContent: latestDoc ? JSON.parse(latestDoc.content || "{}") : null,
            version: latestDoc?.version || 1,
            requirements,
            stakeholders,
            conflicts,
            sources: sourceMeta,
        };
    },
});

// ─── Record access to shared link ────────────────────────────────────────────
export const recordAccess = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const link = await ctx.db
            .query("sharedLinks")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (link) {
            await ctx.db.patch(link._id, {
                accessCount: (link.accessCount || 0) + 1,
                lastAccessedAt: Date.now(),
            });
        }
    },
});
