import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store API Key ───────────────────────────────────────────────────────────
export const storeKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("gemini"),
      v.literal("anthropic"),
      v.literal("custom")
    ),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    // Simple hash for storage (in production use proper encryption)
    const keyHash = btoa(args.key);
    const keyPreview =
      args.key.substring(0, 6) + "..." + args.key.substring(args.key.length - 4);

    // Deactivate existing keys for this provider
    const existing = await ctx.db.query("apiKeys").collect();
    for (const key of existing) {
      if (key.provider === args.provider && key.isActive) {
        await ctx.db.patch(key._id, { isActive: false });
      }
    }

    return await ctx.db.insert("apiKeys", {
      provider: args.provider,
      keyHash,
      keyPreview,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// ─── Get Active Keys ─────────────────────────────────────────────────────────
export const getActiveKeys = query({
  handler: async (ctx) => {
    const keys = await ctx.db.query("apiKeys").collect();
    return keys
      .filter((k) => k.isActive)
      .map((k) => ({
        _id: k._id,
        provider: k.provider,
        keyPreview: k.keyPreview,
        isActive: k.isActive,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
      }));
  },
});

// ─── Delete Key ──────────────────────────────────────────────────────────────
export const deleteKey = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.keyId);
  },
});

// ─── Get raw key for AI calls (internal use) ─────────────────────────────────
export const getKeyForProvider = query({
  args: { provider: v.union(v.literal("openai"), v.literal("gemini"), v.literal("anthropic"), v.literal("custom")) },
  handler: async (ctx, args) => {
    const keys = await ctx.db.query("apiKeys").collect();
    const active = keys.find((k) => k.provider === args.provider && k.isActive);
    if (!active) return null;
    return atob(active.keyHash);
  },
});
