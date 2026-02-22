import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store/Update Setting ────────────────────────────────────────────────────
export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });
  },
});

// ─── Get Setting ─────────────────────────────────────────────────────────────
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting ? setting.value : null;
  },
});

// ─── Get All Settings ────────────────────────────────────────────────────────
export const getAll = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  },
});
