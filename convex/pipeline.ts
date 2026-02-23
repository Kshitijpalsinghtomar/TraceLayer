import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Check if Pipeline is Running ────────────────────────────────────────────
export const isPipelineRunning = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(5);

    const activeStatuses = ["queued", "ingesting", "classifying", "extracting_requirements",
      "extracting_stakeholders", "extracting_decisions", "extracting_timeline",
      "detecting_conflicts", "building_traceability", "generating_documents"];

    const runningRun = runs.find((run) => activeStatuses.includes(run.status));
    return runningRun ? { isRunning: true, runId: runningRun._id, status: runningRun.status } : { isRunning: false };
  },
});

// ─── Cancel Running Pipeline ────────────────────────────────────────────────
export const cancelPipeline = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(5);

    const activeStatuses = ["queued", "ingesting", "classifying", "extracting_requirements",
      "extracting_stakeholders", "extracting_decisions", "extracting_timeline",
      "detecting_conflicts", "building_traceability", "generating_documents"];

    let cancelledCount = 0;
    for (const run of runs) {
      if (activeStatuses.includes(run.status)) {
        await ctx.db.patch(run._id, { status: "cancelled", completedAt: Date.now() });
        cancelledCount++;
      }
    }

    await ctx.db.patch(args.projectId, { status: "draft", progress: 0 });
    return { success: true, cancelledCount };
  },
});

// ─── Create Extraction Run ──────────────────────────────────────────────────
export const createRun = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.insert("extractionRuns", {
      projectId: args.projectId,
      status: "queued",
      startedAt: Date.now(),
      sourcesProcessed: 0,
      requirementsFound: 0,
      stakeholdersFound: 0,
      decisionsFound: 0,
      conflictsFound: 0,
    });
  },
});

// ─── Update Run Status ───────────────────────────────────────────────────────
export const updateRunStatus = mutation({
  args: {
    runId: v.id("extractionRuns"),
    status: v.union(
      v.literal("queued"),
      v.literal("ingesting"),
      v.literal("classifying"),
      v.literal("extracting_requirements"),
      v.literal("extracting_stakeholders"),
      v.literal("extracting_decisions"),
      v.literal("extracting_timeline"),
      v.literal("detecting_conflicts"),
      v.literal("building_traceability"),
      v.literal("generating_documents"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    sourcesProcessed: v.optional(v.number()),
    requirementsFound: v.optional(v.number()),
    stakeholdersFound: v.optional(v.number()),
    decisionsFound: v.optional(v.number()),
    conflictsFound: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { runId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (args.status === "completed" || args.status === "failed" || args.status === "cancelled") {
      (filtered as Record<string, unknown>).completedAt = Date.now();
    }
    await ctx.db.patch(runId, filtered);
  },
});

// ─── Log Agent Activity ──────────────────────────────────────────────────────
export const log = mutation({
  args: {
    projectId: v.id("projects"),
    extractionRunId: v.id("extractionRuns"),
    agent: v.union(
      v.literal("ingestion_agent"),
      v.literal("classification_agent"),
      v.literal("requirement_agent"),
      v.literal("stakeholder_agent"),
      v.literal("decision_agent"),
      v.literal("timeline_agent"),
      v.literal("conflict_agent"),
      v.literal("traceability_agent"),
      v.literal("document_agent"),
      v.literal("orchestrator"),
      v.literal("integration_agent")
    ),
    level: v.union(
      v.literal("info"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentLogs", {
      projectId: args.projectId,
      extractionRunId: args.extractionRunId,
      agent: args.agent as any,
      level: args.level,
      message: args.message,
      detail: args.detail,
      timestamp: Date.now(),
    });
  },
});

// ─── Get Logs for Run (real-time) ────────────────────────────────────────────
export const getLogsForRun = query({
  args: { extractionRunId: v.id("extractionRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentLogs")
      .withIndex("by_run", (q) => q.eq("extractionRunId", args.extractionRunId))
      .collect();
  },
});

// ─── Get Latest Run for Project ──────────────────────────────────────────────
export const getLatestRun = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(1);
    return runs[0] || null;
  },
});

// ─── Get All Runs for Project (history) ──────────────────────────────────────
export const listRunsForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(20);
  },
});

// ─── Get All Logs for Project ────────────────────────────────────────────────
export const getLogsForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentLogs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(200);
  },
});

// ─── Get Recent Activity (across all projects, for dashboard) ────────────────
export const getRecentActivity = query({
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("agentLogs")
      .order("desc")
      .take(30);
    return logs;
  },
});

// ─── Get All Extraction Runs (for dashboard) ─────────────────────────────────
export const listAllRuns = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("extractionRuns")
      .order("desc")
      .take(10);
  },
});

