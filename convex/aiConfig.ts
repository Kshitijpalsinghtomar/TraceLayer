import { action, query, QueryCtx } from "./_generated/server";

/**
 * aiConfig.ts — Centralized AI configuration
 *
 * All AI features (chat, copilot, pipeline) resolve their
 * provider, API key, and model from this single source.
 *
 * Config is set by the admin via settings:
 *   - "default_provider" → openrouter | openai | gemini | anthropic
 *   - "openrouter_model" → model slug (default: meta-llama/llama-4-maverick:free)
 */

export type AIProvider = "openai" | "gemini" | "anthropic" | "openrouter";

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model: string;
}

// ─── Internal helper (usable from other server code) ─────────────────────────
export async function resolveAIConfig(ctx: QueryCtx): Promise<AIConfig | null> {
    // 1. Read admin-chosen provider from settings
    const providerSetting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q: any) => q.eq("key", "default_provider"))
        .first();

    const modelSetting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q: any) => q.eq("key", "openrouter_model"))
        .first();

    const allKeys = await ctx.db.query("apiKeys").collect();
    const activeKeys = allKeys.filter((k: any) => k.isActive);

    // 2. Determine provider: admin setting → fallback auto-detect
    let provider: AIProvider | null = null;

    if (providerSetting?.value) {
        const p = providerSetting.value as AIProvider;
        // Verify the chosen provider actually has an API key
        if (activeKeys.some((k: any) => k.provider === p)) {
            provider = p;
        }
    }

    // Auto-detect: prioritize openrouter (free) → openai → gemini → anthropic
    if (!provider) {
        const priority: AIProvider[] = ["openrouter", "openai", "gemini", "anthropic"];
        for (const p of priority) {
            if (activeKeys.some((k: any) => k.provider === p)) {
                provider = p;
                break;
            }
        }
    }

    if (!provider) return null;

    // 3. Get API key
    const keyRecord = activeKeys.find((k: any) => k.provider === provider);
    if (!keyRecord) return null;
    const apiKey = atob(keyRecord.keyHash);

    // 4. Determine model
    let model: string;
    switch (provider) {
        case "openrouter":
            model = modelSetting?.value || "deepseek/deepseek-chat-v3-0324:free";
            break;
        case "openai":
            model = "gpt-4o";
            break;
        case "gemini":
            model = "gemini-2.0-flash";
            break;
        case "anthropic":
            model = "claude-sonnet-4-20250514";
            break;
    }

    return { provider, apiKey, model };
}

// ─── Public query (for frontend availability checks) ─────────────────────────
export const getAIConfig = query({
    handler: async (ctx) => {
        const config = await resolveAIConfig(ctx);
        if (!config) return null;
        // Never expose the API key to the frontend
        return {
            provider: config.provider,
            model: config.model,
            configured: true,
        };
    },
});

// ─── Fetch available OpenRouter models (for admin picker) ─────────────────────
export const fetchOpenRouterModels = action({
    handler: async (): Promise<{
        id: string;
        name: string;
        contextLength: number;
        isFree: boolean;
        promptPricing: string;
        completionPricing: string;
        description: string;
    }[]> => {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/models");
            if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
            const data = await res.json();

            const models = (data.data || []).map((m: any) => {
                const promptPrice = parseFloat(m.pricing?.prompt || "0");
                const completionPrice = parseFloat(m.pricing?.completion || "0");
                const isFree = promptPrice === 0 && completionPrice === 0;

                return {
                    id: m.id as string,
                    name: (m.name || m.id) as string,
                    contextLength: (m.context_length || 0) as number,
                    isFree,
                    promptPricing: promptPrice === 0 ? "Free" : `$${promptPrice.toFixed(6)}/tok`,
                    completionPricing: completionPrice === 0 ? "Free" : `$${completionPrice.toFixed(6)}/tok`,
                    description: ((m.description || "").substring(0, 120)) as string,
                };
            });

            // Sort: free models first, then alphabetically
            models.sort((a: any, b: any) => {
                if (a.isFree && !b.isFree) return -1;
                if (!a.isFree && b.isFree) return 1;
                return a.name.localeCompare(b.name);
            });

            return models;
        } catch (e: any) {
            console.error("Failed to fetch OpenRouter models:", e.message);
            return [];
        }
    },
});
