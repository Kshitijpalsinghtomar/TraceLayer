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

// ─── Get Pipeline Health Diagnostics ─────────────────────────────────────────
export const getDiagnostics = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const runs = await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(20);
    const logs = runs[0]
      ? await ctx.db
          .query("agentLogs")
          .withIndex("by_run", (q) => q.eq("extractionRunId", runs[0]._id))
          .collect()
      : [];

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
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const timelineEvents = await ctx.db
      .query("timelineEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Error counts from latest run
    const errorLogs = logs.filter((l) => l.level === "error");
    const warningLogs = logs.filter((l) => l.level === "warning");

    // Source health
    const uploadedSources = sources.filter((s) => s.status === "uploaded");
    const extractedSources = sources.filter((s) => s.status === "extracted");
    const failedSources = sources.filter((s) => s.status === "failed");

    // Run stats
    const completedRuns = runs.filter((r) => r.status === "completed");
    const failedRuns = runs.filter((r) => r.status === "failed");
    const cancelledRuns = runs.filter((r) => r.status === "cancelled");

    // Average duration of completed runs
    const durations = completedRuns
      .filter((r) => r.completedAt && r.startedAt)
      .map((r) => (r.completedAt! - r.startedAt) / 1000);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Data quality
    const lowConfidenceReqs = requirements.filter((r) => r.confidenceScore < 0.5);
    const highConfidenceReqs = requirements.filter((r) => r.confidenceScore >= 0.8);
    const avgConfidence = requirements.length > 0
      ? requirements.reduce((s, r) => s + r.confidenceScore, 0) / requirements.length
      : 0;

    return {
      project: project ? { name: project.name, status: project.status, progress: project.progress } : null,
      sources: {
        total: sources.length,
        uploaded: uploadedSources.length,
        extracted: extractedSources.length,
        failed: failedSources.length,
        totalWords: sources.reduce((s, src) => s + (src.metadata?.wordCount || 0), 0),
      },
      extraction: {
        requirements: requirements.length,
        stakeholders: stakeholders.length,
        decisions: decisions.length,
        timelineEvents: timelineEvents.length,
        conflicts: conflicts.length,
        documents: documents.length,
      },
      quality: {
        avgConfidence,
        highConfidence: highConfidenceReqs.length,
        lowConfidence: lowConfidenceReqs.length,
        total: requirements.length,
      },
      runs: {
        total: runs.length,
        completed: completedRuns.length,
        failed: failedRuns.length,
        cancelled: cancelledRuns.length,
        avgDurationSec: Math.round(avgDuration),
        latestRun: runs[0] || null,
      },
      errors: {
        count: errorLogs.length,
        warnings: warningLogs.length,
        recentErrors: errorLogs.slice(0, 5).map((l) => ({
          agent: l.agent,
          message: l.message,
          timestamp: l.timestamp,
        })),
      },
    };
  },
});

// ─── Clear Run History (keep latest N) ───────────────────────────────────────
export const clearRunHistory = mutation({
  args: { projectId: v.id("projects"), keepLatest: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keep = args.keepLatest ?? 1;
    const runs = await ctx.db
      .query("extractionRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    let deleted = 0;
    for (let i = keep; i < runs.length; i++) {
      // Delete associated logs
      const logs = await ctx.db
        .query("agentLogs")
        .withIndex("by_run", (q) => q.eq("extractionRunId", runs[i]._id))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
      }
      await ctx.db.delete(runs[i]._id);
      deleted++;
    }
    return { deleted };
  },
});

// ─── Delete Single Source ────────────────────────────────────────────────────
export const deleteSource = mutation({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;
    const projectId = source.projectId;
    await ctx.db.delete(args.sourceId);
    // Update project count
    const project = await ctx.db.get(projectId);
    if (project) {
      await ctx.db.patch(projectId, {
        sourceCount: Math.max(0, project.sourceCount - 1),
        updatedAt: Date.now(),
      });
    }
  },
});
