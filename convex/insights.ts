/**
 * insights.ts — Smart AI Insights Engine
 *
 * Computes proactive intelligence from existing data:
 * - Quality scores, coverage gaps, risk indicators
 * - Stakeholder alignment analysis
 * - Requirement health metrics
 * - Conflict severity assessment
 *
 * These are computed queries (no new tables), analyzing live data
 * to surface actionable intelligence without requiring API calls.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Insight {
  id: string;
  type: "quality" | "risk" | "coverage" | "suggestion" | "alert" | "achievement";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  metric?: number; // 0-100 percentage
  icon: string; // lucide icon name
  category: string;
}

// ─── Global Dashboard Insights ────────────────────────────────────────────────
export const getDashboardInsights = query({
  args: {},
  handler: async (ctx): Promise<Insight[]> => {
    const insights: Insight[] = [];
    const projects = await ctx.db.query("projects").collect();
    const allRequirements = await ctx.db.query("requirements").collect();
    const allStakeholders = await ctx.db.query("stakeholders").collect();
    const allConflicts = await ctx.db.query("conflicts").collect();
    const allDecisions = await ctx.db.query("decisions").collect();
    const allSources = await ctx.db.query("sources").collect();
    const allRuns = await ctx.db.query("extractionRuns").collect();

    if (projects.length === 0) {
      insights.push({
        id: "no-projects",
        type: "suggestion",
        severity: "info",
        title: "Get Started",
        description: "Create your first project and upload documents to begin extracting requirements intelligence.",
        icon: "Rocket",
        category: "Setup",
      });
      return insights;
    }

    // ── Overall Intelligence Health Score ──────────────────────────────────
    const totalReqs = allRequirements.length;
    const totalSources = allSources.length;
    const totalStakeholders = allStakeholders.length;
    const totalConflicts = allConflicts.length;
    const unresolvedConflicts = allConflicts.filter(c => c.status !== "resolved").length;
    const completedRuns = allRuns.filter(r => r.status === "completed").length;
    const failedRuns = allRuns.filter(r => r.status === "failed").length;

    // Confidence analysis
    const avgConfidence = totalReqs > 0
      ? allRequirements.reduce((sum, r) => sum + r.confidenceScore, 0) / totalReqs
      : 0;
    const lowConfidenceReqs = allRequirements.filter(r => r.confidenceScore < 0.6);
    const highConfidenceReqs = allRequirements.filter(r => r.confidenceScore >= 0.85);

    // Requirement category distribution
    const categoryMap = new Map<string, number>();
    for (const r of allRequirements) {
      categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1);
    }

    // Priority distribution
    const priorityMap = new Map<string, number>();
    for (const r of allRequirements) {
      priorityMap.set(r.priority, (priorityMap.get(r.priority) || 0) + 1);
    }

    // ── Intelligence Health Score ─────────────────────────────────────────
    let healthScore = 50; // base
    if (totalReqs > 0) healthScore += 10;
    if (totalReqs > 5) healthScore += 5;
    if (totalReqs > 10) healthScore += 5;
    if (totalStakeholders > 0) healthScore += 5;
    if (totalStakeholders > 3) healthScore += 5;
    if (avgConfidence >= 0.7) healthScore += 10;
    if (unresolvedConflicts === 0) healthScore += 5;
    else healthScore -= unresolvedConflicts * 3;
    if (completedRuns > 0) healthScore += 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    insights.push({
      id: "health-score",
      type: "quality",
      severity: healthScore >= 80 ? "success" : healthScore >= 60 ? "info" : "warning",
      title: "Intelligence Health Score",
      description: `Your overall intelligence quality is ${healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : "needs attention"}. ${totalReqs} requirements extracted across ${projects.length} project${projects.length > 1 ? "s" : ""}.`,
      metric: healthScore,
      icon: "Activity",
      category: "Quality",
    });

    // ── Confidence Gap Analysis ───────────────────────────────────────────
    if (lowConfidenceReqs.length > 0) {
      const pct = Math.round((lowConfidenceReqs.length / totalReqs) * 100);
      insights.push({
        id: "low-confidence",
        type: "risk",
        severity: pct > 40 ? "critical" : pct > 20 ? "warning" : "info",
        title: "Confidence Gap Detected",
        description: `${lowConfidenceReqs.length} requirement${lowConfidenceReqs.length > 1 ? "s" : ""} (${pct}%) have confidence scores below 0.6. These need additional source evidence or stakeholder validation.`,
        metric: 100 - pct,
        icon: "ShieldAlert",
        category: "Quality",
      });
    }

    if (highConfidenceReqs.length > 0 && totalReqs > 0) {
      const pct = Math.round((highConfidenceReqs.length / totalReqs) * 100);
      if (pct >= 70) {
        insights.push({
          id: "high-confidence",
          type: "achievement",
          severity: "success",
          title: "Strong Evidence Base",
          description: `${pct}% of requirements have high confidence scores (≥0.85). Your source documents provide clear, traceable evidence.`,
          metric: pct,
          icon: "CheckCircle2",
          category: "Quality",
        });
      }
    }

    // ── Conflict Resolution Status ────────────────────────────────────────
    if (unresolvedConflicts > 0) {
      const criticalConflicts = allConflicts.filter(c => c.severity === "critical" && c.status !== "resolved");
      insights.push({
        id: "unresolved-conflicts",
        type: "alert",
        severity: criticalConflicts.length > 0 ? "critical" : "warning",
        title: `${unresolvedConflicts} Unresolved Conflict${unresolvedConflicts > 1 ? "s" : ""}`,
        description: criticalConflicts.length > 0
          ? `${criticalConflicts.length} critical conflict${criticalConflicts.length > 1 ? "s" : ""} require immediate attention. Contradictory requirements may impact architecture decisions.`
          : `${unresolvedConflicts} conflict${unresolvedConflicts > 1 ? "s" : ""} between requirements need stakeholder review for resolution.`,
        icon: "AlertTriangle",
        category: "Risk",
      });
    } else if (totalConflicts > 0) {
      insights.push({
        id: "conflicts-resolved",
        type: "achievement",
        severity: "success",
        title: "All Conflicts Resolved",
        description: `All ${totalConflicts} detected conflicts have been resolved. Your requirement set is consistent and aligned.`,
        icon: "CheckCircle",
        category: "Risk",
      });
    }

    // ── Category Coverage ─────────────────────────────────────────────────
    const expectedCategories = ["functional", "non_functional", "security", "performance", "business", "technical"];
    const missingCategories = expectedCategories.filter(c => !categoryMap.has(c));

    if (missingCategories.length > 0 && totalReqs > 3) {
      insights.push({
        id: "missing-categories",
        type: "coverage",
        severity: missingCategories.includes("security") ? "warning" : "info",
        title: "Coverage Gap",
        description: `No ${missingCategories.map(c => c.replace(/_/g, " ")).join(", ")} requirements detected. Consider whether these areas need explicit requirements.`,
        metric: Math.round(((expectedCategories.length - missingCategories.length) / expectedCategories.length) * 100),
        icon: "LayoutGrid",
        category: "Coverage",
      });
    }

    if (missingCategories.length === 0 && totalReqs >= 6) {
      insights.push({
        id: "full-coverage",
        type: "achievement",
        severity: "success",
        title: "Full Category Coverage",
        description: "Requirements span all major categories: functional, non-functional, security, performance, business, and technical.",
        metric: 100,
        icon: "Shield",
        category: "Coverage",
      });
    }

    // ── Stakeholder Orphans ───────────────────────────────────────────────
    const stakeholderWithReqs = new Set(allRequirements.flatMap(r => r.stakeholderIds.map(s => s.toString())));
    const orphanStakeholders = allStakeholders.filter(s => !stakeholderWithReqs.has(s._id.toString()));

    if (orphanStakeholders.length > 0 && allStakeholders.length > 0) {
      insights.push({
        id: "stakeholder-orphans",
        type: "coverage",
        severity: "info",
        title: "Unlinked Stakeholders",
        description: `${orphanStakeholders.length} stakeholder${orphanStakeholders.length > 1 ? "s" : ""} (${orphanStakeholders.map(s => s.name).slice(0, 3).join(", ")}${orphanStakeholders.length > 3 ? "..." : ""}) have no linked requirements. Consider reviewing their contributions.`,
        icon: "UserX",
        category: "Coverage",
      });
    }

    // ── Pipeline Performance ──────────────────────────────────────────────
    if (completedRuns > 0) {
      const successRate = Math.round((completedRuns / (completedRuns + failedRuns)) * 100);
      insights.push({
        id: "pipeline-health",
        type: "quality",
        severity: successRate >= 90 ? "success" : successRate >= 70 ? "info" : "warning",
        title: "Pipeline Reliability",
        description: `${successRate}% success rate across ${completedRuns + failedRuns} pipeline run${completedRuns + failedRuns > 1 ? "s" : ""}. ${completedRuns} completed, ${failedRuns} failed.`,
        metric: successRate,
        icon: "Gauge",
        category: "System",
      });
    }

    // ── Decision Coverage ─────────────────────────────────────────────────
    if (allDecisions.length > 0) {
      const approvedDecisions = allDecisions.filter(d => d.status === "approved");
      const pendingDecisions = allDecisions.filter(d => d.status === "proposed");

      if (pendingDecisions.length > 0) {
        insights.push({
          id: "pending-decisions",
          type: "suggestion",
          severity: "info",
          title: `${pendingDecisions.length} Pending Decision${pendingDecisions.length > 1 ? "s" : ""}`,
          description: `${pendingDecisions.map(d => d.title).slice(0, 2).join(", ")}${pendingDecisions.length > 2 ? ` and ${pendingDecisions.length - 2} more` : ""} await approval. Unresolved decisions may block implementation.`,
          icon: "GitBranch",
          category: "Decisions",
        });
      }

      if (approvedDecisions.length > 0 && approvedDecisions.length === allDecisions.length) {
        insights.push({
          id: "decisions-approved",
          type: "achievement",
          severity: "success",
          title: "All Decisions Approved",
          description: `All ${allDecisions.length} architecture decisions have been approved. Decision log is complete.`,
          icon: "CheckCircle2",
          category: "Decisions",
        });
      }
    }

    // ── Source Diversity ───────────────────────────────────────────────────
    const sourceTypes = new Set(allSources.map(s => s.type));
    if (sourceTypes.size >= 3) {
      insights.push({
        id: "source-diversity",
        type: "achievement",
        severity: "success",
        title: "Multi-Channel Intelligence",
        description: `Data ingested from ${sourceTypes.size} distinct channel types: ${Array.from(sourceTypes).map(t => t.replace(/_/g, " ")).join(", ")}. Multi-channel analysis increases extraction accuracy.`,
        icon: "Layers",
        category: "Data",
      });
    } else if (totalSources > 0 && sourceTypes.size === 1) {
      insights.push({
        id: "single-source-type",
        type: "suggestion",
        severity: "info",
        title: "Single Channel Data",
        description: "All sources are from one channel type. Adding data from meetings, emails, or chat logs would improve requirement coverage and conflict detection.",
        icon: "MessageSquare",
        category: "Data",
      });
    }

    return insights;
  },
});

// ─── Project-Specific Insights ────────────────────────────────────────────────
export const getProjectInsights = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<Insight[]> => {
    const insights: Insight[] = [];
    const requirements = await ctx.db.query("requirements").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const stakeholders = await ctx.db.query("stakeholders").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const conflicts = await ctx.db.query("conflicts").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const decisions = await ctx.db.query("decisions").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const sources = await ctx.db.query("sources").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const docs = await ctx.db.query("documents").withIndex("by_project", q => q.eq("projectId", projectId)).collect();

    const totalReqs = requirements.length;
    if (totalReqs === 0 && sources.length === 0) {
      insights.push({
        id: "empty-project",
        type: "suggestion",
        severity: "info",
        title: "Upload Sources to Begin",
        description: "Upload communication artifacts (emails, meeting transcripts, Slack logs) and tell the AI to analyze them.",
        icon: "Upload",
        category: "Setup",
      });
      return insights;
    }

    if (sources.length > 0 && totalReqs === 0) {
      insights.push({
        id: "sources-unprocessed",
        type: "suggestion",
        severity: "warning",
        title: "Sources Ready for Analysis",
        description: `${sources.length} source${sources.length > 1 ? "s" : ""} uploaded but no requirements extracted yet. Run the extraction pipeline to process them.`,
        icon: "Play",
        category: "Pipeline",
      });
    }

    // ── Requirement Quality ───────────────────────────────────────────────
    if (totalReqs > 0) {
      const avgConf = requirements.reduce((s, r) => s + r.confidenceScore, 0) / totalReqs;
      const criticalReqs = requirements.filter(r => r.priority === "critical");
      const unconfirmedCritical = criticalReqs.filter(r => r.status !== "confirmed");

      if (unconfirmedCritical.length > 0) {
        insights.push({
          id: "unconfirmed-critical",
          type: "risk",
          severity: "critical",
          title: `${unconfirmedCritical.length} Critical Requirements Unconfirmed`,
          description: `Critical-priority requirements need stakeholder confirmation before implementation: ${unconfirmedCritical.map(r => r.requirementId).slice(0, 3).join(", ")}`,
          icon: "AlertOctagon",
          category: "Quality",
        });
      }

      // Quality score
      let qualityScore = Math.round(avgConf * 100);
      if (stakeholders.length > 0) qualityScore = Math.min(100, qualityScore + 5);
      if (decisions.length > 0) qualityScore = Math.min(100, qualityScore + 5);
      if (conflicts.filter(c => c.status === "resolved").length === conflicts.length && conflicts.length > 0) {
        qualityScore = Math.min(100, qualityScore + 5);
      }

      insights.push({
        id: "project-quality",
        type: "quality",
        severity: qualityScore >= 80 ? "success" : qualityScore >= 60 ? "info" : "warning",
        title: "Requirement Quality Score",
        description: `Average confidence: ${(avgConf * 100).toFixed(0)}%. ${totalReqs} requirements, ${stakeholders.length} stakeholders, ${decisions.length} decisions traced.`,
        metric: qualityScore,
        icon: "BarChart3",
        category: "Quality",
      });
    }

    // ── BRD Status ────────────────────────────────────────────────────────
    const brdDocs = docs.filter(d => d.type === "brd");
    if (brdDocs.length > 0) {
      const latest = brdDocs.sort((a, b) => b.version - a.version)[0];
      insights.push({
        id: "brd-ready",
        type: "achievement",
        severity: "success",
        title: "BRD Document Generated",
        description: `Version ${latest.version} generated from ${latest.generatedFrom.requirementCount} requirements and ${latest.generatedFrom.sourceCount} sources. Ready for review and export.`,
        icon: "FileText",
        category: "Document",
      });
    }

    return insights;
  },
});
