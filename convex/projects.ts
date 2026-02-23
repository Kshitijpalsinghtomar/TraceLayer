import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Create Project ─────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    outputFormat: v.union(v.literal("brd"), v.literal("prd"), v.literal("both")),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const colors = ["#6B7AE8", "#66BB8C", "#E8A838", "#D4738C", "#8B5CF6", "#F97316", "#06B6D4"];
    const color = args.color || colors[Math.floor(Math.random() * colors.length)];

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      status: "draft",
      outputFormat: args.outputFormat,
      color,
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceCount: 0,
      requirementCount: 0,
      stakeholderCount: 0,
      decisionCount: 0,
      conflictCount: 0,
    });

    return projectId;
  },
});

// ─── Get All Projects ────────────────────────────────────────────────────────
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

// ─── Get Single Project ──────────────────────────────────────────────────────
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// ─── Update Project ──────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("extracted"),
      v.literal("generating"),
      v.literal("active"),
      v.literal("completed")
    )),
    progress: v.optional(v.number()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    brdFocus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(projectId, { ...filtered, updatedAt: Date.now() });
  },
});

// ─── Get Project Stats ───────────────────────────────────────────────────────
export const getStats = query({
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === "active" || p.status === "processing").length;
    const totalRequirements = projects.reduce((sum, p) => sum + p.requirementCount, 0);
    const totalStakeholders = projects.reduce((sum, p) => sum + p.stakeholderCount, 0);
    const totalSources = projects.reduce((sum, p) => sum + p.sourceCount, 0);
    const totalDecisions = projects.reduce((sum, p) => sum + p.decisionCount, 0);
    const totalConflicts = projects.reduce((sum, p) => sum + p.conflictCount, 0);

    return {
      totalProjects,
      activeProjects,
      totalRequirements,
      totalStakeholders,
      totalSources,
      totalDecisions,
      totalConflicts,
    };
  },
});

// ─── Refresh project counts from actual data ─────────────────────────────────
export const refreshCounts = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const stakeholders = await ctx.db
      .query("stakeholders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const conflicts = await ctx.db
      .query("conflicts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    await ctx.db.patch(args.projectId, {
      sourceCount: sources.length,
      requirementCount: requirements.length,
      stakeholderCount: stakeholders.length,
      decisionCount: decisions.length,
      conflictCount: conflicts.length,
      updatedAt: Date.now(),
    });
  },
});

// ─── Clear Extraction Data (for regeneration) ─────────────────────────────────
// This clears all extracted data but keeps sources so the pipeline can re-run
export const clearExtractionData = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { projectId } = args;

    // Clear requirements
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const req of requirements) {
      await ctx.db.delete(req._id);
    }

    // Clear stakeholders
    const stakeholders = await ctx.db
      .query("stakeholders")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const sh of stakeholders) {
      await ctx.db.delete(sh._id);
    }

    // Clear decisions
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const dec of decisions) {
      await ctx.db.delete(dec._id);
    }

    // Clear conflicts
    const conflicts = await ctx.db
      .query("conflicts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const con of conflicts) {
      await ctx.db.delete(con._id);
    }

    // Mark existing documents as outdated (keep for version history)
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const doc of docs) {
      if (doc.status === "ready") {
        await ctx.db.patch(doc._id, { status: "outdated" });
      }
    }

    // Clear traceability links
    const traceLinks = await ctx.db
      .query("traceabilityLinks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const link of traceLinks) {
      await ctx.db.delete(link._id);
    }

    // Clear timeline events
    const timelineEvents = await ctx.db
      .query("timelineEvents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const event of timelineEvents) {
      await ctx.db.delete(event._id);
    }

    // Reset source statuses to 'uploaded' for re-processing
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const source of sources) {
      await ctx.db.patch(source._id, { status: "uploaded", relevanceScore: undefined });
    }

    // Update project counts
    await ctx.db.patch(projectId, {
      requirementCount: 0,
      stakeholderCount: 0,
      decisionCount: 0,
      conflictCount: 0,
      status: "draft",
      progress: 0,
      updatedAt: Date.now(),
    });

    return {
      success: true, cleared: {
        requirements: requirements.length,
        stakeholders: stakeholders.length,
        decisions: decisions.length,
        conflicts: conflicts.length,
        documents: docs.length,
        traceabilityLinks: traceLinks.length,
        timelineEvents: timelineEvents.length,
      }
    };
  },
});

// ─── Delete Project ─────────────────────────────────────────────────────────
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { projectId } = args;

    // Delete all related data
    const sources = await ctx.db.query("sources").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const source of sources) {
      await ctx.db.delete(source._id);
    }

    const requirements = await ctx.db.query("requirements").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const req of requirements) {
      await ctx.db.delete(req._id);
    }

    const stakeholders = await ctx.db.query("stakeholders").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const stakeholder of stakeholders) {
      await ctx.db.delete(stakeholder._id);
    }

    const decisions = await ctx.db.query("decisions").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const decision of decisions) {
      await ctx.db.delete(decision._id);
    }

    const conflicts = await ctx.db.query("conflicts").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const conflict of conflicts) {
      await ctx.db.delete(conflict._id);
    }

    const docs = await ctx.db.query("documents").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    const runs = await ctx.db.query("extractionRuns").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const run of runs) {
      await ctx.db.delete(run._id);
    }

    const logs = await ctx.db.query("agentLogs").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    const messages = await ctx.db.query("chatMessages").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    const traceabilityLinks = await ctx.db.query("traceabilityLinks").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const link of traceabilityLinks) {
      await ctx.db.delete(link._id);
    }

    const timelineEvents = await ctx.db.query("timelineEvents").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const event of timelineEvents) {
      await ctx.db.delete(event._id);
    }

    // Finally delete the project itself
    await ctx.db.delete(projectId);
  },
});
