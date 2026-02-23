import { v } from "convex/values";
import { mutation, query, action, internalQuery } from "./_generated/server";

// ─── Key format patterns per provider ────────────────────────────────────────
const KEY_PATTERNS: Record<string, { regex: RegExp; hint: string }> = {
  openai: { regex: /^sk-/, hint: "OpenAI keys start with 'sk-'" },
  anthropic: { regex: /^sk-ant-/, hint: "Anthropic keys start with 'sk-ant-'" },
  gemini: { regex: /^AIza/, hint: "Gemini keys start with 'AIza'" },
  custom: { regex: /.{8,}/, hint: "Key must be at least 8 characters" },
};

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
    // Validate key format
    const pattern = KEY_PATTERNS[args.provider];
    if (pattern && !pattern.regex.test(args.key)) {
      throw new Error(`Invalid key format: ${pattern.hint}`);
    }

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

// ─── Get raw key for AI calls (INTERNAL ONLY — never exposed to client) ──────
export const getKeyForProvider = internalQuery({
  args: { provider: v.union(v.literal("openai"), v.literal("gemini"), v.literal("anthropic"), v.literal("custom")) },
  handler: async (ctx, args) => {
    const keys = await ctx.db.query("apiKeys").collect();
    const active = keys.find((k) => k.provider === args.provider && k.isActive);
    if (!active) return null;
    return atob(active.keyHash);
  },
});

// ─── Check if a key exists (public — returns boolean only) ───────────────────
export const hasKeyForProvider = query({
  args: { provider: v.union(v.literal("openai"), v.literal("gemini"), v.literal("anthropic"), v.literal("custom")) },
  handler: async (ctx, args) => {
    const keys = await ctx.db.query("apiKeys").collect();
    return keys.some((k) => k.provider === args.provider && k.isActive);
  },
});

// ─── Resolve best available provider + key (INTERNAL — for actions) ───────────
export const resolveProviderAndKey = internalQuery({
  args: {
    preferredProvider: v.optional(v.union(v.literal("openai"), v.literal("gemini"), v.literal("anthropic"))),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db.query("apiKeys").collect();
    const activeKeys = keys.filter((k) => k.isActive);

    // Try preferred provider first
    if (args.preferredProvider) {
      const preferred = activeKeys.find((k) => k.provider === args.preferredProvider);
      if (preferred) return { provider: preferred.provider as "openai" | "gemini" | "anthropic", apiKey: atob(preferred.keyHash) };
    }

    // Fallback order: gemini → openai → anthropic
    for (const p of ["gemini", "openai", "anthropic"] as const) {
      const key = activeKeys.find((k) => k.provider === p);
      if (key) return { provider: p, apiKey: atob(key.keyHash) };
    }

    return null;
  },
});

// ─── Test Key (validates key against provider API) ───────────────────────────
export const testKey = action({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("gemini"),
      v.literal("anthropic"),
      v.literal("custom")
    ),
    key: v.string(),
  },
  handler: async (_ctx, args): Promise<{ valid: boolean; error?: string }> => {
    try {
      if (args.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${args.key}` },
        });
        if (!res.ok) {
          const body = await res.text();
          return { valid: false, error: res.status === 401 ? "Invalid API key" : `API error: ${res.status} — ${body.substring(0, 100)}` };
        }
        return { valid: true };
      }

      if (args.provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${args.key}`
        );
        if (!res.ok) {
          return { valid: false, error: res.status === 400 || res.status === 403 ? "Invalid API key" : `API error: ${res.status}` };
        }
        return { valid: true };
      }

      if (args.provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": args.key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        // 200 = valid, 401 = bad key, other = may still be valid
        if (res.status === 401) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      // Custom provider — can't validate
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Connection error: ${err.message}` };
    }
  },
});
