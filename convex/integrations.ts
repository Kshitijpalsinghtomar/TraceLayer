import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── List all integrations (optionally for a project) ──────────────────────
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("integrations")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    }
    return await ctx.db.query("integrations").collect();
  },
});

// ─── Get a single integration by app ID ────────────────────────────────────
export const getByApp = query({
  args: { appId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
  },
});

// ─── Connect an integration (create or update) ────────────────────────────
export const connect = mutation({
  args: {
    appId: v.string(),
    label: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    credentials: v.optional(v.object({
      accessToken: v.optional(v.string()),
      tokenPreview: v.optional(v.string()),
      scopes: v.optional(v.array(v.string())),
      expiresAt: v.optional(v.number()),
      connectionMethod: v.optional(v.string()),
    })),
    dataScope: v.optional(v.object({
      channels: v.optional(v.array(v.string())),
      repos: v.optional(v.array(v.string())),
      projects: v.optional(v.array(v.string())),
      pages: v.optional(v.array(v.string())),
      folders: v.optional(v.array(v.string())),
      labels: v.optional(v.array(v.string())),
      dateRange: v.optional(v.object({
        from: v.optional(v.number()),
        to: v.optional(v.number()),
      })),
      includeComments: v.optional(v.boolean()),
      includeAttachments: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    // Check if integration already exists for this app
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "connected",
        label: args.label ?? existing.label,
        credentials: args.credentials ?? existing.credentials,
        dataScope: args.dataScope ?? existing.dataScope,
        projectId: args.projectId ?? existing.projectId,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      appId: args.appId,
      label: args.label,
      status: "connected",
      credentials: args.credentials,
      dataScope: args.dataScope,
      projectId: args.projectId,
      lastSyncAt: undefined,
      lastSyncStatus: undefined,
      itemsSynced: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ─── Update data scope for an integration ──────────────────────────────────
export const updateScope = mutation({
  args: {
    integrationId: v.id("integrations"),
    dataScope: v.object({
      channels: v.optional(v.array(v.string())),
      repos: v.optional(v.array(v.string())),
      projects: v.optional(v.array(v.string())),
      pages: v.optional(v.array(v.string())),
      folders: v.optional(v.array(v.string())),
      labels: v.optional(v.array(v.string())),
      dateRange: v.optional(v.object({
        from: v.optional(v.number()),
        to: v.optional(v.number()),
      })),
      includeComments: v.optional(v.boolean()),
      includeAttachments: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      dataScope: args.dataScope,
      updatedAt: Date.now(),
    });
  },
});

// ─── Disconnect an integration ─────────────────────────────────────────────
export const disconnect = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      status: "disconnected",
      credentials: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ─── Pause / resume ────────────────────────────────────────────────────────
export const togglePause = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    const newStatus = integration.status === "paused" ? "connected" : "paused";
    await ctx.db.patch(args.integrationId, {
      status: newStatus,
      updatedAt: Date.now(),
    });
  },
});

// ─── Record sync result ────────────────────────────────────────────────────
export const recordSync = mutation({
  args: {
    integrationId: v.id("integrations"),
    status: v.string(),
    itemsSynced: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      lastSyncAt: Date.now(),
      lastSyncStatus: args.status,
      itemsSynced: args.itemsSynced,
      updatedAt: Date.now(),
    });
  },
});

// ─── Delete an integration entirely ────────────────────────────────────────
export const remove = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.integrationId);
  },
});

// ─── Get connected integrations count (optionally per project) ──────────────
export const getConnectedCount = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    let all;
    if (args.projectId) {
      all = await ctx.db
        .query("integrations")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      all = await ctx.db.query("integrations").collect();
    }
    const connected = all.filter((i) => i.status === "connected" || i.status === "paused");
    return {
      total: all.length,
      connected: connected.length,
      paused: all.filter((i) => i.status === "paused").length,
    };
  },
});

// ─── List connected (optionally per project, for pipeline to fetch) ────────
export const listConnected = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    let all;
    if (args.projectId) {
      all = await ctx.db
        .query("integrations")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      all = await ctx.db.query("integrations").collect();
    }
    return all.filter((i) => i.status === "connected");
  },
});
