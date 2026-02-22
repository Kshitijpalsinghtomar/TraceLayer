/**
 * ConflictResolutionView — Mark conflicts resolved, add resolution notes,
 * and track BRD accuracy via conflict resolution metrics.
 */
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Clock,
  Loader2,
  Eye,
  X,
  Zap,
  GitMerge,
  ArrowRight,
} from "lucide-react";

type FilterStatus = "all" | "detected" | "reviewing" | "resolved" | "accepted";

const severityConfig = {
  critical: { color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-900" },
  major: { color: "#F59E0B", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-900" },
  minor: { color: "#3B82F6", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-900" },
};

const statusConfig = {
  detected: { label: "Detected", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  reviewing: { label: "Reviewing", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  resolved: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  accepted: { label: "Accepted", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
};

export function ConflictResolutionView() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const conflicts = useQuery(
    api.conflicts.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const requirements = useQuery(
    api.requirements.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const resolveConflict = useMutation(api.conflicts.resolve);

  // Build a lookup map: reqId → requirement object
  const reqLookup = useMemo(() => {
    const map: Record<string, any> = {};
    if (requirements) {
      for (const r of requirements) {
        map[r._id] = r;
      }
    }
    return map;
  }, [requirements]);

  const [filter, setFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  const filteredConflicts = useMemo(() => {
    if (!conflicts) return [];
    return conflicts
      .filter((c) => filter === "all" || c.status === filter)
      .filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Unresolved first, then by severity
        const severityOrder = { critical: 0, major: 1, minor: 2 };
        const statusOrder = { detected: 0, reviewing: 1, accepted: 2, resolved: 3 };
        const statusDiff = (statusOrder[a.status as keyof typeof statusOrder] ?? 0) - (statusOrder[b.status as keyof typeof statusOrder] ?? 0);
        if (statusDiff !== 0) return statusDiff;
        return (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 2);
      });
  }, [conflicts, filter, searchQuery]);

  const stats = useMemo(() => {
    if (!conflicts) return { total: 0, resolved: 0, critical: 0, accuracy: 0 };
    const total = conflicts.length;
    const resolved = conflicts.filter((c) => c.status === "resolved" || c.status === "accepted").length;
    const critical = conflicts.filter((c) => c.severity === "critical" && c.status !== "resolved").length;
    const accuracy = total === 0 ? 100 : Math.round((resolved / total) * 100);
    return { total, resolved, critical, accuracy };
  }, [conflicts]);

  const handleResolve = async (conflictId: Id<"conflicts">) => {
    if (!resolutionText.trim()) return;
    setResolving(conflictId);
    try {
      await resolveConflict({ conflictId, resolution: resolutionText.trim() });
      setResolutionText("");
      setExpandedId(null);
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
    } finally {
      setResolving(null);
    }
  };

  if (conflicts === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-10 py-8 max-w-[1000px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="w-9 h-9 rounded-xl hover:bg-accent flex items-center justify-center transition-colors border border-border"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-[24px] tracking-[-0.02em] font-semibold flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              Conflict Resolution
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5">
              Review and resolve requirement conflicts for {project?.name || "this project"}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Conflicts", value: stats.total, color: "#6B7AE8", icon: AlertTriangle },
            { label: "Resolved", value: stats.resolved, color: "#059669", icon: CheckCircle2 },
            { label: "Critical Open", value: stats.critical, color: "#DC2626", icon: Zap },
            { label: "BRD Accuracy", value: `${stats.accuracy}%`, color: "#8B5CF6", icon: FileText },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}12` }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-[24px] font-bold tracking-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conflicts..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(["all", "detected", "reviewing", "resolved", "accepted"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conflict List */}
        {filteredConflicts.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-[16px] font-medium mb-1">
              {conflicts?.length === 0 ? "No conflicts detected" : "No conflicts matching your filter"}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {conflicts?.length === 0
                ? "The AI hasn't detected any contradicting requirements yet."
                : "Try changing the filter or clearing your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConflicts.map((conflict) => {
              const sev = severityConfig[conflict.severity as keyof typeof severityConfig] || severityConfig.minor;
              const stat = statusConfig[conflict.status as keyof typeof statusConfig] || statusConfig.detected;
              const isExpanded = expandedId === conflict._id;
              const isResolved = conflict.status === "resolved" || conflict.status === "accepted";

              return (
                <motion.div
                  key={conflict._id}
                  layout
                  className={`bg-card rounded-2xl border ${isResolved ? "border-border/50" : "border-border"} overflow-hidden transition-all ${
                    isResolved ? "opacity-75" : ""
                  }`}
                >
                  {/* Conflict Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : conflict._id)}
                    className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/30 transition-colors"
                  >
                    {/* Severity indicator */}
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: sev.color }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sev.bg} ${sev.text} ${sev.border} border`}>
                          {conflict.severity}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stat.className}`}>
                          {stat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" />
                          {new Date(conflict.detectedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-[14px] font-medium ${isResolved ? "line-through text-muted-foreground" : ""}`}>
                        {conflict.title}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content — Side-by-Side Comparison */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-5 pb-5 border-t border-border pt-4">
                          {/* Description */}
                          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
                            {conflict.description}
                          </p>

                          {/* Side-by-Side Requirement Comparison */}
                          {conflict.requirementIds.length >= 2 && (
                            <div className="mb-5">
                              <div className="flex items-center gap-2 mb-3">
                                <GitMerge className="w-3.5 h-3.5 text-muted-foreground" />
                                <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">
                                  Conflicting Requirements — Side by Side
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {conflict.requirementIds.slice(0, 2).map((reqId: string, idx: number) => {
                                  const req = reqLookup[reqId];
                                  if (!req) return (
                                    <div key={reqId} className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                      <span className="text-[11px] font-mono text-muted-foreground">{reqId}</span>
                                    </div>
                                  );
                                  const prioMap: Record<string, { bg: string; text: string }> = {
                                    critical: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400" },
                                    high: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400" },
                                    medium: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
                                    low: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400" },
                                  };
                                  const prio = prioMap[req.priority] || prioMap.medium;
                                  return (
                                    <div
                                      key={reqId}
                                      className={`rounded-xl p-4 border-2 transition-all ${
                                        idx === 0
                                          ? "border-blue-200/60 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10"
                                          : "border-amber-200/60 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${idx === 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
                                          {idx === 0 ? "A" : "B"}
                                        </span>
                                        <span className="text-[11px] font-mono text-muted-foreground">{req.requirementId}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${prio.bg} ${prio.text}`}>
                                          {req.priority}
                                        </span>
                                      </div>
                                      <h5 className="text-[13px] font-semibold mb-2 leading-tight">{req.title}</h5>
                                      <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-4">{req.description}</p>
                                      {req.sourceExcerpt && (
                                        <div className="mt-3 pt-2 border-t border-border/30">
                                          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Source Evidence</p>
                                          <p className="text-[11px] italic text-foreground/60 line-clamp-2">&ldquo;{req.sourceExcerpt}&rdquo;</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Resolution action buttons */}
                              {!isResolved && (
                                <div className="flex items-center gap-2 mt-3">
                                  {conflict.requirementIds.slice(0, 2).map((reqId: string, idx: number) => {
                                    const req = reqLookup[reqId];
                                    return (
                                      <button
                                        key={reqId}
                                        onClick={() => setResolutionText(`Accepted ${idx === 0 ? "Option A" : "Option B"}: ${req?.requirementId || ""} — ${req?.title || reqId}. This requirement takes priority based on stakeholder consensus.`)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all border ${
                                          idx === 0
                                            ? "border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                            : "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                        }`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Accept {idx === 0 ? "A" : "B"}
                                      </button>
                                    );
                                  })}
                                  <button
                                    onClick={() => setResolutionText("Merged both requirements: A compromise was reached that addresses concerns from both sides. The implementation will incorporate elements from both requirements with adjusted scope.")}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all border border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                  >
                                    <GitMerge className="w-3.5 h-3.5" />
                                    Merge
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fallback: simple requirement IDs if < 2 resolved */}
                          {conflict.requirementIds.length < 2 && (
                            <div className="mb-4">
                              <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider mb-2">
                                Involved Requirements ({conflict.requirementIds.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {conflict.requirementIds.map((reqId: string) => {
                                  const req = reqLookup[reqId];
                                  return (
                                    <span key={reqId} className="text-[11px] bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-mono">
                                      {req?.requirementId || reqId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Resolution (if resolved) */}
                          {conflict.resolution && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">Resolution</span>
                              </div>
                              <p className="text-[13px] text-foreground leading-relaxed">{conflict.resolution}</p>
                            </div>
                          )}

                          {/* Resolution input (if not resolved) */}
                          {!isResolved && (
                            <div className="space-y-3">
                              <textarea
                                value={resolutionText}
                                onChange={(e) => setResolutionText(e.target.value)}
                                placeholder="Describe how this conflict was resolved (e.g., stakeholder decision, requirement updated, accepted trade-off)..."
                                rows={3}
                                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all resize-none"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setExpandedId(null);
                                    setResolutionText("");
                                  }}
                                  className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border hover:bg-accent"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict._id as Id<"conflicts">)}
                                  disabled={!resolutionText.trim() || resolving === conflict._id}
                                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {resolving === conflict._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                  )}
                                  Mark Resolved
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
