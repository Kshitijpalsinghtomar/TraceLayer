import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Store a chat message ────────────────────────────────────────────────────
export const sendMessage = mutation({
  args: {
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(
      v.object({
        provider: v.optional(v.string()),
        action: v.optional(v.string()),
        section: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

// ─── Get chat messages for a project ─────────────────────────────────────────
export const listMessages = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

// ─── List all recent chat activity (for search & profile) ───────────────────
export const list = query({
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("chatMessages")
      .order("desc")
      .take(50);
    // Group by project for a meaningful list
    const grouped = new Map<string, { projectId: string; messages: typeof messages; _creationTime: number }>(); 
    for (const msg of messages) {
      const key = msg.projectId;
      if (!grouped.has(key)) {
        grouped.set(key, { projectId: msg.projectId, messages: [], _creationTime: msg.timestamp });
      }
      grouped.get(key)!.messages.push(msg);
    }
    return Array.from(grouped.values());
  },
});
