import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Sync or create a user from auth provider data (Logto, etc.).
 * Called on every login / app load to keep user data fresh.
 */
export const syncUser = mutation({
    args: {
        authProviderId: v.string(),
        email: v.string(),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();

        if (existing) {
            // Update last login and sync profile data
            await ctx.db.patch(existing._id, {
                email: args.email,
                name: args.name,
                avatarUrl: args.avatarUrl,
                lastLoginAt: Date.now(),
            });
            return existing._id;
        }

        // First-time user — create record
        // Admin bootstrap: if no users exist yet, the first user becomes admin
        const allUsers = await ctx.db.query("users").collect();
        const isFirstUser = allUsers.length === 0;

        const userId = await ctx.db.insert("users", {
            authProviderId: args.authProviderId,
            email: args.email,
            name: args.name,
            avatarUrl: args.avatarUrl,
            role: isFirstUser ? "admin" : "member",
            onboardingCompleted: false,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
        });

        return userId;
    },
});

/**
 * Get current user by auth provider ID (Logto sub, etc.)
 */
export const getByAuthProviderId = query({
    args: { authProviderId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();
    },
});

/**
 * Get user by internal Convex ID
 */
export const get = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.userId);
    },
});

/**
 * Complete user onboarding
 */
export const completeOnboarding = mutation({
    args: { authProviderId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();
        if (user) {
            await ctx.db.patch(user._id, { onboardingCompleted: true });
        }
    },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
    args: {
        authProviderId: v.string(),
        name: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();
        if (!user) throw new Error("User not found");

        const updates: Record<string, unknown> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

        await ctx.db.patch(user._id, updates);
    },
});

/**
 * Get user role by auth provider ID.
 * Returns the role string or null if user not found.
 */
export const getRole = query({
    args: { authProviderId: v.string() },
    handler: async (ctx, args) => {
        if (!args.authProviderId) return null;
        const user = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.authProviderId))
            .unique();
        return user?.role ?? null;
    },
});

/**
 * Set a user's role (admin-only operation).
 * The caller must be an admin to change roles.
 */
export const setRole = mutation({
    args: {
        callerAuthProviderId: v.string(),
        targetAuthProviderId: v.string(),
        role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    },
    handler: async (ctx, args) => {
        // Verify caller is admin
        const caller = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.callerAuthProviderId))
            .unique();
        if (!caller || caller.role !== "admin") {
            throw new Error("Unauthorized: only admins can change user roles");
        }

        // Find target user
        const target = await ctx.db
            .query("users")
            .withIndex("by_auth_provider_id", (q) => q.eq("authProviderId", args.targetAuthProviderId))
            .unique();
        if (!target) throw new Error("Target user not found");

        await ctx.db.patch(target._id, { role: args.role });
    },
});
