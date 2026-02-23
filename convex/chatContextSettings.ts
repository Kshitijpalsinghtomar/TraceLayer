import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * chatContextSettings.ts — Cross-project AI Chat access toggles.
 *
 * Each user can configure which additional projects the AI Chat
 * inside a given project is allowed to access. This enables
 * selective cross-project context without breaking project isolation.
 */

// ─── Get settings for a project + user pair ────────────────────────────────
export const get = query({
    args: {
        projectId: v.id("projects"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chatContextSettings")
            .withIndex("by_project_user", (q) =>
                q.eq("projectId", args.projectId).eq("userId", args.userId)
            )
            .unique();
    },
});

// ─── Create or update cross-project access list ────────────────────────────
export const upsert = mutation({
    args: {
        projectId: v.id("projects"),
        userId: v.id("users"),
        allowedProjectIds: v.array(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("chatContextSettings")
            .withIndex("by_project_user", (q) =>
                q.eq("projectId", args.projectId).eq("userId", args.userId)
            )
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                allowedProjectIds: args.allowedProjectIds,
                updatedAt: Date.now(),
            });
            return existing._id;
        }

        return await ctx.db.insert("chatContextSettings", {
            projectId: args.projectId,
            userId: args.userId,
            allowedProjectIds: args.allowedProjectIds,
            updatedAt: Date.now(),
        });
    },
});

// ─── Toggle a single project in the allowed list ───────────────────────────
export const toggleProject = mutation({
    args: {
        projectId: v.id("projects"),
        userId: v.id("users"),
        targetProjectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("chatContextSettings")
            .withIndex("by_project_user", (q) =>
                q.eq("projectId", args.projectId).eq("userId", args.userId)
            )
            .unique();

        if (existing) {
            const currentList = existing.allowedProjectIds;
            const idx = currentList.indexOf(args.targetProjectId);
            const newList =
                idx >= 0
                    ? currentList.filter((id) => id !== args.targetProjectId)
                    : [...currentList, args.targetProjectId];
            await ctx.db.patch(existing._id, {
                allowedProjectIds: newList,
                updatedAt: Date.now(),
            });
            return newList;
        }

        // First time — create with this project
        await ctx.db.insert("chatContextSettings", {
            projectId: args.projectId,
            userId: args.userId,
            allowedProjectIds: [args.targetProjectId],
            updatedAt: Date.now(),
        });
        return [args.targetProjectId];
    },
});

// ─── Delete settings entirely ──────────────────────────────────────────────
export const remove = mutation({
    args: {
        projectId: v.id("projects"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("chatContextSettings")
            .withIndex("by_project_user", (q) =>
                q.eq("projectId", args.projectId).eq("userId", args.userId)
            )
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});
