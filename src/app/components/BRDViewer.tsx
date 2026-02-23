/**
 * BRDViewer — Convex-connected Business Requirements Document viewer
 * Reads generated BRD document + live entity data from Convex
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Target,
  CheckSquare,
  Users,
  Shield,
  ChevronRight,
  Download,
  Share2,
  X,
  ArrowUp,
  ArrowRight as ArrowRightIcon,
  ArrowDown,
  Table2,
  Network,
  AlertTriangle,
  Zap,
  ExternalLink,
  BarChart3,
  Layers,
  GitBranch,
  BookOpen,
  ShieldAlert,
  RotateCcw,
  History,
  Plus,
  Minus,
  Sparkles,
  Loader2,
  FileStack,
  Pencil,
  Check,
  Link2,
  CheckCircle2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ExportShareModal } from "./ExportShareModal";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BRDContent {
  executiveSummary?: string;
  projectOverview?: string;
  businessObjectives?: Array<{
    id: string;
    title: string;
    description: string;
    metrics?: string;
    successCriteria?: string;
    owner?: string;
    linkedRequirements?: string[];
  }>;
  scopeDefinition?: {
    inScope?: string[];
    outOfScope?: string[];
    assumptions?: string[];
    constraints?: string[];
  };
  stakeholderAnalysis?: string;
  functionalAnalysis?: string;
  nonFunctionalAnalysis?: string;
  decisionAnalysis?: string;
  riskAssessment?: string;
  intelligenceSummary?: {
    totalSources?: number;
    totalRequirements?: number;
    totalStakeholders?: number;
    totalDecisions?: number;
    totalConflicts?: number;
    overallConfidence?: number;
    summary?: string;
    categoryBreakdown?: string;
    priorityBreakdown?: string;
    communicationChannels?: string[];
  };
  confidenceReport?: {
    highConfidence?: number;
    mediumConfidence?: number;
    lowConfidence?: number;
    overallScore?: number;
    coverageGaps?: string[];
    recommendations?: string[];
  };
  [key: string]: unknown;
}

/** Normalize BRD keys — pipeline may generate camelCase or snake_case */
function normalizeBRD(raw: Record<string, unknown>): BRDContent {
  const out: Record<string, unknown> = { ...raw };
  const snakeToCamel: Record<string, string> = {
    executive_summary: "executiveSummary",
    project_overview: "projectOverview",
    business_objectives: "businessObjectives",
    scope_definition: "scopeDefinition",
    stakeholder_analysis: "stakeholderAnalysis",
    functional_analysis: "functionalAnalysis",
    non_functional_analysis: "nonFunctionalAnalysis",
    decision_analysis: "decisionAnalysis",
    risk_assessment: "riskAssessment",
    intelligence_summary: "intelligenceSummary",
    confidence_report: "confidenceReport",
  };
  for (const [snake, camel] of Object.entries(snakeToCamel)) {
    if (raw[snake] && !raw[camel]) {
      out[camel] = raw[snake];
    }
  }
  // Also normalize nested scope_definition keys
  if (out.scopeDefinition && typeof out.scopeDefinition === "object") {
    const scope = out.scopeDefinition as Record<string, unknown>;
    if (scope.in_scope && !scope.inScope) scope.inScope = scope.in_scope;
    if (scope.out_of_scope && !scope.outOfScope) scope.outOfScope = scope.out_of_scope;
  }
  return out as BRDContent;
}

interface ReqRecord {
  _id: string;
  requirementId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  confidenceScore: number;
  sourceExcerpt: string;
  extractionReasoning?: string;
  tags?: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const sections = [
  { id: "full-document", label: "Full Document", icon: FileStack },
  { id: "summary", label: "Executive Summary", icon: FileText },
  { id: "overview", label: "Project Overview", icon: BookOpen },
  { id: "objectives", label: "Business Objectives", icon: Target },
  { id: "scope", label: "Scope Definition", icon: Layers },
  { id: "stakeholder-analysis", label: "Stakeholder Analysis", icon: Users },
  { id: "functional-analysis", label: "Functional Analysis", icon: CheckSquare },
  { id: "requirements", label: "Requirements List", icon: CheckSquare },
  { id: "nonfunctional-analysis", label: "Non-Functional Analysis", icon: Shield },
  { id: "decision-analysis", label: "Decision Analysis", icon: GitBranch },
  { id: "risk-assessment", label: "Risk Assessment", icon: ShieldAlert },
  { id: "conflicts", label: "Conflicts", icon: AlertTriangle },
  { id: "traceability", label: "Traceability Matrix", icon: Table2 },
  { id: "confidence", label: "Confidence Report", icon: BarChart3 },
];

const priorityConfig: Record<string, { label: string; icon: typeof ArrowUp; className: string }> = {
  critical: { label: "Critical", icon: ArrowUp, className: "text-rose-700 bg-rose-50" },
  high: { label: "High", icon: ArrowUp, className: "text-rose-600 bg-rose-50" },
  medium: { label: "Medium", icon: ArrowRightIcon, className: "text-amber-600 bg-amber-50" },
  low: { label: "Low", icon: ArrowDown, className: "text-blue-600 bg-blue-50" },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  discovered: { label: "Discovered", className: "bg-blue-50 text-blue-700" },
  validated: { label: "Validated", className: "bg-emerald-50 text-emerald-700" },
  refined: { label: "Refined", className: "bg-purple-50 text-purple-700" },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700" },
  deferred: { label: "Deferred", className: "bg-muted text-muted-foreground" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  functional: { label: "Functional", color: "#3B82F6" },
  non_functional: { label: "Non-Functional", color: "#8B5CF6" },
  business: { label: "Business", color: "#F97316" },
  technical: { label: "Technical", color: "#06B6D4" },
  security: { label: "Security", color: "#EF4444" },
  performance: { label: "Performance", color: "#22C55E" },
  compliance: { label: "Compliance", color: "#64748B" },
  integration: { label: "Integration", color: "#EC4899" },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function BRDViewer() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = projectId as Id<"projects"> | undefined;

  const project = useQuery(api.projects.get, pid ? { projectId: pid } : "skip");
  const allDocs = useQuery(api.documents.listByProject, pid ? { projectId: pid } : "skip");
  const requirements = useQuery(api.requirements.listByProject, pid ? { projectId: pid } : "skip");
  const stakeholders = useQuery(api.stakeholders.listByProject, pid ? { projectId: pid } : "skip");
  const conflicts = useQuery(api.conflicts.listByProject, pid ? { projectId: pid } : "skip");
  const sources = useQuery(api.sources.listByProject, pid ? { projectId: pid } : "skip");
  const latestRun = useQuery(api.pipeline.getLatestRun, pid ? { projectId: pid } : "skip");
  const traceGraph = useQuery(api.traceability.getProjectGraph, pid ? { projectId: pid } : "skip");

  const updateContent = useMutation(api.documents.updateContent);
  const runPipeline = useAction(api.extraction.runExtractionPipeline);
  const syncAndRun = useAction(api.integrationSync.syncAndRunPipeline);

  // Centralized AI config (managed by admin)
  const aiConfig = useQuery(api.aiConfig.getAIConfig);
  const connectedIntegrations = useQuery(api.integrations.listConnected, pid ? {} : "skip");

  const [activeSection, setActiveSection] = useState("full-document");
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [regenStatus, setRegenStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Pipeline running detection — derived from server state (survives refresh)
  const isPipelineRunning = latestRun && !["completed", "failed", "cancelled"].includes(latestRun.status);

  // Track when pipeline completes (reactive — auto-updates via Convex subscription)
  const prevRunStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prevStatus = prevRunStatusRef.current;
    const currStatus = latestRun?.status;
    // If we had a non-terminal status and now it's completed → show success
    if (prevStatus && !["completed", "failed", "cancelled"].includes(prevStatus)) {
      if (currStatus === "completed") {
        setSelectedVersion(null); // Reset to auto-select latest version
        setRegenStatus({ type: "success", msg: "BRD regenerated successfully!" });
        setTimeout(() => setRegenStatus(null), 6000);
      } else if (currStatus === "failed") {
        setRegenStatus({ type: "error", msg: `Pipeline failed: ${(latestRun as any)?.error || "Unknown error"}` });
        setTimeout(() => setRegenStatus(null), 8000);
      }
    }
    prevRunStatusRef.current = currStatus;
  }, [latestRun?.status]);

  // Inline editing handlers
  const startEditing = (sectionKey: string, currentValue: string) => {
    setEditingSection(sectionKey);
    setEditBuffer(currentValue);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditBuffer("");
  };

  const saveEdit = async (sectionKey: string) => {
    if (!currentDoc || !editBuffer.trim()) return;
    setIsSaving(true);
    try {
      const parsed = currentDoc.content ? JSON.parse(currentDoc.content) : {};
      // Handle nested keys like "scopeDefinition.inScope"
      const keys = sectionKey.split(".");
      let target = parsed;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = editBuffer;
      await updateContent({ documentId: currentDoc._id, content: JSON.stringify(parsed) });
      setEditingSection(null);
      setEditBuffer("");
    } catch (e) {
      console.error("Failed to save edit:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle regenerate BRD — fire pipeline and track progress reactively via latestRun
  const handleRegenerate = useCallback(() => {
    if (!pid || isPipelineRunning) return;

    if (!aiConfig?.configured) {
      setRegenStatus({ type: "error", msg: "No AI provider configured. Ask admin to set up in Admin Panel." });
      setTimeout(() => setRegenStatus(null), 6000);
      return;
    }

    // Fire the pipeline action (don't await — it's long-running)
    // Progress is tracked reactively via the latestRun query subscription
    setRegenStatus({ type: "info", msg: "Starting regeneration..." });
    setShowRegenConfirm(false);

    const hasIntegrations = connectedIntegrations && connectedIntegrations.length > 0;
    const pipelineCall = hasIntegrations
      ? syncAndRun({ projectId: pid, regenerate: true })
      : runPipeline({ projectId: pid, regenerate: true });

    pipelineCall
      .catch((e: any) => {
        setRegenStatus({ type: "error", msg: e.message || "Pipeline failed to start" });
        setTimeout(() => setRegenStatus(null), 8000);
      });

    // Clear the "Starting..." message after a short delay (pipeline status will take over)
    setTimeout(() => {
      setRegenStatus((prev) => prev?.type === "info" ? null : prev);
    }, 3000);
  }, [pid, isPipelineRunning, aiConfig, connectedIntegrations, runPipeline, syncAndRun]);

  // Get BRD versions only
  const brdDocs = useMemo(() => {
    if (!allDocs) return [];
    return allDocs
      .filter((d: any) => d.type === "brd")
      .sort((a: any, b: any) => b.version - a.version);
  }, [allDocs]);

  // Current BRD based on selection or latest
  const currentDoc = useMemo(() => {
    if (!brdDocs || brdDocs.length === 0) return null;
    if (selectedVersion) {
      return brdDocs.find((d: any) => d.version === selectedVersion) || brdDocs[0];
    }
    return brdDocs[0];
  }, [brdDocs, selectedVersion]);

  const brdContent: BRDContent = useMemo(() => {
    if (!currentDoc?.content) return {};
    try {
      const raw = JSON.parse(currentDoc.content);
      return normalizeBRD(raw);
    } catch {
      return { executiveSummary: currentDoc.content };
    }
  }, [currentDoc]);

  const selectedRequirement = selectedReqId
    ? (requirements || []).find((r: any) => r._id === selectedReqId) || null
    : null;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // No BRD generated yet — show empty state OR pipeline-in-progress state
  if (brdDocs.length === 0 && (requirements || []).length === 0) {
    // If pipeline is actively running, show a live progress screen instead of the empty state
    if (isPipelineRunning) {
      const stageLabels: Record<string, string> = {
        queued: "Queued — waiting to start",
        ingesting: "Ingesting sources",
        classifying: "Classifying documents",
        extracting_requirements: "Extracting requirements",
        extracting_stakeholders: "Identifying stakeholders",
        extracting_decisions: "Analyzing decisions",
        extracting_timeline: "Building timeline",
        detecting_conflicts: "Detecting conflicts",
        building_traceability: "Building traceability matrix",
        generating_documents: "Generating BRD document",
      };
      const currentStage = latestRun?.status || "queued";
      const stageKeys = Object.keys(stageLabels);
      const stageIndex = stageKeys.indexOf(currentStage);
      const progress = stageIndex >= 0 ? Math.round(((stageIndex + 1) / stageKeys.length) * 100) : 5;

      return (
        <div className="flex items-center justify-center h-[calc(100vh-60px)]">
          <div className="text-center max-w-lg relative">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-52 h-52 bg-primary/8 rounded-full blur-3xl animate-pulse" />
            <div className="relative space-y-6">
              {/* Animated icon */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center mx-auto shadow-xl shadow-primary/10">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>

              <div>
                <h2 className="text-[22px] font-semibold mb-1.5">Generating Your BRD</h2>
                <p className="text-[13px] text-muted-foreground">
                  The AI pipeline is processing your sources. This may take a minute or two.
                </p>
              </div>

              {/* Progress bar */}
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span className="font-medium text-primary">{stageLabels[currentStage] || currentStage.replace(/_/g, " ")}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stage list */}
              <div className="max-w-xs mx-auto text-left space-y-1">
                {stageKeys.map((key, i) => {
                  const isActive = key === currentStage;
                  const isDone = i < stageIndex;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md text-[11px] transition-colors ${isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : isDone
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground/50"
                        }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      {stageLabels[key]}
                    </div>
                  );
                })}
              </div>

              {regenStatus && (
                <div className={`mx-auto max-w-xs px-3 py-1.5 rounded-lg text-[11px] ${regenStatus.type === "error"
                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                  }`}>
                  {regenStatus.msg}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Pipeline not running and no BRD — show empty state
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="text-center max-w-md relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/5">
              <FileText className="w-8 h-8 text-primary/40" />
            </div>
            <h2 className="text-[20px] font-semibold mb-2">No BRD Generated Yet</h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
              Upload your documents and tell the AI to analyze them. The extraction pipeline will process your sources and generate a comprehensive BRD.
            </p>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Go to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* BRD sidebar navigation - IMPROVED */}
      <div className="w-[260px] shrink-0 border-r border-border/40 bg-gradient-to-b from-card via-card to-muted/15 flex flex-col backdrop-blur-sm">
        {/* Header */}
        <div className="px-4 pt-5 pb-4 border-b border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">BRD Document</span>
          </div>
          <h3 className="text-[15px] font-semibold leading-tight mb-1">{project.name}</h3>

          {/* Version selector */}
          {brdDocs.length > 0 && (
            <div className="mt-3 relative">
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-white/95 dark:hover:bg-slate-800 transition-colors w-full"
                style={{ border: '1px solid var(--border, rgba(15,23,42,0.06))' }}
              >
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[12px] font-medium flex-1 text-left text-foreground">
                  Version {currentDoc?.version || 1}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {brdDocs.length > 1 ? `${brdDocs.length} versions` : ''}
                </span>
              </button>

              {/* Version dropdown */}
              <AnimatePresence>
                {showVersionHistory && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 z-50 mt-1 w-[260px] rounded-xl shadow-2xl overflow-hidden max-h-[320px] overflow-y-auto border border-border bg-white dark:bg-slate-900"
                  >
                    <div className="px-3 py-2 border-b border-border/50 bg-white/5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Version History</span>
                    </div>
                    {brdDocs.map((doc: any, idx: number) => (
                      <button
                        key={doc._id}
                        onClick={() => {
                          setSelectedVersion(doc.version);
                          setShowVersionHistory(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${doc.version === currentDoc?.version ? "bg-primary/8" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-foreground">v{doc.version}</span>
                            {idx === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Latest</span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${doc.status === "ready"
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                              }`}>
                              {doc.status}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(doc.generatedAt).toLocaleDateString()}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Navigation sections - grouped */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {/* Full document view */}
          <div className="mb-4">
            <button
              onClick={() => setActiveSection("full-document")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-left transition-all duration-150 font-medium ${activeSection === "full-document"
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-foreground hover:bg-muted hover:text-foreground border border-transparent"
                }`}
            >
              <FileStack className="w-4 h-4 shrink-0" />
              Full Document
            </button>
          </div>

          {/* Main sections */}
          <div className="mb-4">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 px-2">
              Document Sections
            </p>
            {sections.slice(1, 9).map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-all duration-150 ${activeSection === section.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                {section.label}
              </button>
            ))}
          </div>

          {/* Data sections */}
          <div className="mb-4">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 px-2">
              Intelligence Data
            </p>
            {sections.slice(9).map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-all duration-150 ${activeSection === section.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Stats & Actions footer */}
        <div className="px-4 pb-4 border-t border-border/30 mt-auto">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2 mb-3 mt-3">
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[16px] font-bold text-primary">{requirements?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Requirements</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[16px] font-bold text-emerald-600">{stakeholders?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Stakeholders</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[16px] font-bold text-amber-600">{sources?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Sources</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[16px] font-bold text-red-600">{conflicts?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Conflicts</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-1.5">
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] bg-primary/8 hover:bg-primary/12 text-primary transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Back to Chat
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </button>
            {/* Regenerate BRD button */}
            {isPipelineRunning ? (
              <div className="w-full rounded-lg bg-primary/5 border border-primary/20 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-[12px] font-medium text-primary">Pipeline Running</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1">
                  Stage: {latestRun?.status?.replace(/_/g, " ") || "starting"}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRegenConfirm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerate BRD
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </button>
            )}

            {/* Confirmation dialog */}
            {showRegenConfirm && (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/40 p-3 space-y-2">
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  This will clear existing data and re-run the full extraction pipeline. Continue?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRegenConfirm(false)}
                    className="flex-1 px-2 py-1.5 text-[11px] rounded-md bg-muted hover:bg-muted/70 text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerate}
                    className="flex-1 px-2 py-1.5 text-[11px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}

            {/* Status feedback toast */}
            {regenStatus && (
              <div className={`mt-1 px-3 py-1.5 rounded-lg text-[11px] ${regenStatus.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                  : regenStatus.type === "error"
                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30"
                }`}>
                {regenStatus.msg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main BRD content */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border/40 px-8 py-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold">
              {sections.find((s) => s.id === activeSection)?.label}
            </span>
            {!currentDoc && (
              <span className="text-[11px] bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-medium border border-amber-200/50">
                No BRD generated — run the pipeline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] bg-gradient-to-r from-primary/10 to-violet-500/10 text-primary hover:from-primary/15 hover:to-violet-500/15 rounded-xl transition-all font-medium shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              Export & Share
            </button>
          </div>
        </div>

        <div className="px-10 py-8 max-w-[900px]">
          <AnimatePresence mode="wait">
            {/* ─── FULL DOCUMENT COMPILATION ──────────────────────── */}
            {activeSection === "full-document" && (
              <SectionWrapper key="full-document">
                <div className="mb-10 pb-8 border-b border-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary/60" />
                    <span className="text-[11px] uppercase tracking-widest text-primary/60 font-semibold">AI-Generated Document</span>
                  </div>
                  <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-tight">Business Requirements Document</h1>
                  <p className="text-[15px] text-muted-foreground mt-2">{project.name} — Version {currentDoc?.version || 1}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[12px] bg-gradient-to-r from-primary/10 to-primary/5 text-primary px-3 py-1.5 rounded-full font-medium border border-primary/10">
                      {(requirements || []).length} Requirements
                    </span>
                    <span className="text-[12px] bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 text-emerald-700 px-3 py-1.5 rounded-full font-medium border border-emerald-500/10">
                      {(stakeholders || []).length} Stakeholders
                    </span>
                    <span className="text-[12px] bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-700 px-3 py-1.5 rounded-full font-medium border border-amber-500/10">
                      {(sources || []).length} Sources
                    </span>
                  </div>
                </div>

                {/* Executive Summary */}
                {brdContent.executiveSummary && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <FileText className="w-5 h-5" />
                      1. Executive Summary
                    </h2>
                    <EditableTextSection
                      sectionKey="executiveSummary"
                      content={brdContent.executiveSummary}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Project Overview */}
                {brdContent.projectOverview && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <BookOpen className="w-5 h-5" />
                      2. Project Overview
                    </h2>
                    <EditableTextSection
                      sectionKey="projectOverview"
                      content={brdContent.projectOverview}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Business Objectives */}
                {brdContent.businessObjectives && brdContent.businessObjectives.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <Target className="w-5 h-5" />
                      3. Business Objectives
                    </h2>
                    <div className="space-y-3">
                      {brdContent.businessObjectives.map((obj, i) => (
                        <div key={obj.id || i} className="bg-card rounded-xl border border-border/50 p-5">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[12px] font-bold text-primary bg-primary/10 w-7 h-7 rounded-lg flex items-center justify-center">{i + 1}</span>
                            <h4 className="text-[14px] font-semibold">{obj.title}</h4>
                          </div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed ml-10">{obj.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scope Definition */}
                {brdContent.scopeDefinition && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <Layers className="w-5 h-5" />
                      4. Scope Definition
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {brdContent.scopeDefinition.inScope && brdContent.scopeDefinition.inScope.length > 0 && (
                        <div className="bg-emerald-50/40 rounded-xl border border-emerald-200/30 p-4">
                          <h4 className="text-[13px] font-semibold text-emerald-700 mb-2">In Scope</h4>
                          <ul className="space-y-1">{brdContent.scopeDefinition.inScope.map((s, i) => <li key={i} className="text-[12px] text-emerald-700/80 flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">+</span>{s}</li>)}</ul>
                        </div>
                      )}
                      {brdContent.scopeDefinition.outOfScope && brdContent.scopeDefinition.outOfScope.length > 0 && (
                        <div className="bg-red-50/40 rounded-xl border border-red-200/30 p-4">
                          <h4 className="text-[13px] font-semibold text-red-700 mb-2">Out of Scope</h4>
                          <ul className="space-y-1">{brdContent.scopeDefinition.outOfScope.map((s, i) => <li key={i} className="text-[12px] text-red-700/80 flex items-start gap-1.5"><span className="text-red-500 mt-0.5">-</span>{s}</li>)}</ul>
                        </div>
                      )}
                    </div>
                    {brdContent.scopeDefinition.assumptions && brdContent.scopeDefinition.assumptions.length > 0 && (
                      <div className="mt-3 bg-amber-50/40 rounded-xl border border-amber-200/30 p-4">
                        <h4 className="text-[13px] font-semibold text-amber-700 mb-2">Assumptions</h4>
                        <ul className="space-y-1">{brdContent.scopeDefinition.assumptions.map((s, i) => <li key={i} className="text-[12px] text-amber-700/80 flex items-start gap-1.5"><span className="mt-0.5">*</span>{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Stakeholder Analysis */}
                {(brdContent.stakeholderAnalysis || (stakeholders && stakeholders.length > 0)) && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <Users className="w-5 h-5" />
                      5. Stakeholder Analysis
                    </h2>
                    {brdContent.stakeholderAnalysis && (
                      <div className="mb-3">
                        <EditableTextSection
                          sectionKey="stakeholderAnalysis"
                          content={brdContent.stakeholderAnalysis}
                          editingSection={editingSection}
                          editBuffer={editBuffer}
                          isSaving={isSaving}
                          onStartEdit={startEditing}
                          onCancel={cancelEditing}
                          onSave={saveEdit}
                          onChangeBuffer={setEditBuffer}
                        />
                      </div>
                    )}
                    {stakeholders && stakeholders.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {stakeholders.map((person: any) => (
                          <div key={person._id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-semibold text-primary shrink-0">
                              {person.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
                            </div>
                            <div className="min-w-0"><p className="text-[12px] font-medium truncate">{person.name}</p><p className="text-[10px] text-muted-foreground truncate">{person.role}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Functional Analysis */}
                {brdContent.functionalAnalysis && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <CheckSquare className="w-5 h-5" />
                      6. Functional Requirements Analysis
                    </h2>
                    <EditableTextSection
                      sectionKey="functionalAnalysis"
                      content={brdContent.functionalAnalysis}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Requirements List */}
                {requirements && requirements.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <CheckSquare className="w-5 h-5" />
                      7. Requirements ({requirements.length})
                    </h2>
                    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                      <div className="grid grid-cols-[70px_1fr_75px_85px_60px] gap-2 px-4 py-2 bg-muted/30 border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        <span>ID</span><span>Title</span><span>Priority</span><span>Category</span><span>Conf.</span>
                      </div>
                      <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
                        {(requirements as any[]).map((req: any) => (
                          <div key={req._id} className="grid grid-cols-[70px_1fr_75px_85px_60px] gap-2 px-4 py-2.5 text-[12px] items-center hover:bg-muted/20">
                            <span className="font-mono text-[10px] text-muted-foreground">{req.requirementId}</span>
                            <span className="truncate font-medium">{req.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit ${priorityConfig[req.priority]?.className || ''}`}>{priorityConfig[req.priority]?.label || req.priority}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full w-fit capitalize" style={{ backgroundColor: (categoryConfig[req.category]?.color || "#64748B") + "15", color: categoryConfig[req.category]?.color || "#64748B" }}>{categoryConfig[req.category]?.label || req.category}</span>
                            <span className="text-[11px] text-muted-foreground">{Math.round(req.confidenceScore * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-Functional Analysis */}
                {brdContent.nonFunctionalAnalysis && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <Shield className="w-5 h-5" />
                      8. Non-Functional Requirements
                    </h2>
                    <EditableTextSection
                      sectionKey="nonFunctionalAnalysis"
                      content={brdContent.nonFunctionalAnalysis}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Decision Analysis */}
                {brdContent.decisionAnalysis && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <GitBranch className="w-5 h-5" />
                      9. Decision Analysis
                    </h2>
                    <EditableTextSection
                      sectionKey="decisionAnalysis"
                      content={brdContent.decisionAnalysis}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Risk Assessment */}
                {brdContent.riskAssessment && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <ShieldAlert className="w-5 h-5" />
                      10. Risk Assessment
                    </h2>
                    <EditableTextSection
                      sectionKey="riskAssessment"
                      content={brdContent.riskAssessment}
                      editingSection={editingSection}
                      editBuffer={editBuffer}
                      isSaving={isSaving}
                      onStartEdit={startEditing}
                      onCancel={cancelEditing}
                      onSave={saveEdit}
                      onChangeBuffer={setEditBuffer}
                    />
                  </div>
                )}

                {/* Conflicts */}
                {conflicts && conflicts.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      11. Detected Conflicts ({conflicts.length})
                    </h2>
                    <div className="space-y-3">
                      {conflicts.map((conflict: any) => (
                        <ConflictCard key={conflict._id} conflict={conflict} requirements={requirements as any[]} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence summary */}
                {brdContent.confidenceReport && (
                  <div className="mb-8">
                    <h2 className="text-[20px] font-semibold mb-3 flex items-center gap-2 text-primary">
                      <BarChart3 className="w-5 h-5" />
                      12. Confidence Report
                    </h2>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[22px] font-bold text-primary">{brdContent.confidenceReport.overallScore ? `${Math.round(Number(brdContent.confidenceReport.overallScore) * 100)}%` : "—"}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Overall Score</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[22px] font-bold text-emerald-600">{brdContent.confidenceReport.highConfidence ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">High Confidence</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[22px] font-bold text-amber-600">{brdContent.confidenceReport.mediumConfidence ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Medium</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[22px] font-bold text-red-600">{brdContent.confidenceReport.lowConfidence ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Low Confidence</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!brdContent.executiveSummary && (!requirements || requirements.length === 0) && (
                  <EmptyState message="No BRD content available yet. Run the extraction pipeline to generate the full document." />
                )}
              </SectionWrapper>
            )}

            {/* ─── EXECUTIVE SUMMARY ──────────────────────────────── */}
            {activeSection === "summary" && (
              <SectionWrapper key="summary">
                <SectionHeader
                  title="Executive Summary"
                  subtitle={`Generated from ${(sources || []).length} communication sources • Version ${currentDoc?.version || '-'}`}
                />
                {brdContent.executiveSummary ? (
                  <EditableTextSection
                    sectionKey="executiveSummary"
                    content={brdContent.executiveSummary}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Run the extraction pipeline to generate an executive summary." />
                )}

                {/* Intelligence Summary from pipeline */}
                {brdContent.intelligenceSummary?.summary && (
                  <div className="bg-gradient-to-r from-primary/4 to-primary/8 rounded-2xl border border-primary/10 p-6 mt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h4 className="text-[13px] font-medium text-primary">Intelligence Summary</h4>
                    </div>
                    <p className="text-[13px] leading-relaxed text-foreground/75 whitespace-pre-line">
                      {brdContent.intelligenceSummary.summary}
                    </p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <SummaryCard value={(sources || []).length} label="Sources analyzed" color="text-amber-600" bg="from-amber-50 to-amber-100/50" />
                  <SummaryCard value={(requirements || []).length} label="Requirements found" color="text-primary" bg="from-indigo-50 to-indigo-100/50" />
                  <SummaryCard value={(stakeholders || []).length} label="Stakeholders identified" color="text-emerald-600" bg="from-emerald-50 to-emerald-100/50" />
                </div>

                {requirements && requirements.length > 0 && (() => {
                  const priorityChartData = (["critical", "high", "medium", "low"] as const).map((p) => ({
                    name: priorityConfig[p].label,
                    count: requirements.filter((r: any) => r.priority === p).length,
                    fill: { critical: "#DC2626", high: "#F97316", medium: "#EAB308", low: "#3B82F6" }[p],
                  }));
                  const categoryChartData = Object.entries(
                    requirements.reduce((acc: Record<string, number>, r: any) => {
                      acc[r.category] = (acc[r.category] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([name, value]) => ({
                    name: name.replace(/_/g, " "),
                    value: value as number,
                    fill: categoryConfig[name]?.color || "#94A3B8",
                  }));
                  return (
                    <div className="mt-8 grid grid-cols-2 gap-6">
                      <div className="bg-card rounded-2xl border border-border/50 p-6">
                        <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          Priority Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={priorityChartData} barSize={32}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              content={({ active, payload, label }: any) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-[12px]">
                                    <p className="font-medium mb-1">{label}</p>
                                    {payload.map((entry: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.payload?.fill }} />
                                        <span className="text-muted-foreground">Count:</span>
                                        <span className="font-medium">{entry.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="count" name="Requirements" radius={[6, 6, 0, 0]}>
                              {priorityChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-card rounded-2xl border border-border/50 p-6">
                        <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          Category Breakdown
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categoryChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }: any) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-[12px]">
                                    <p className="font-medium capitalize">{payload[0].name}</p>
                                    <p className="text-muted-foreground">Count: {payload[0].value}</p>
                                  </div>
                                );
                              }}
                            />
                            <Legend formatter={(value: string) => <span className="text-[10px] capitalize">{value}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })()}
              </SectionWrapper>
            )}

            {/* ─── PROJECT OVERVIEW ───────────────────────────────── */}
            {activeSection === "overview" && (
              <SectionWrapper key="overview">
                <SectionHeader title="Project Overview" subtitle="High-level project context and background" />
                {/* Quick project facts */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-primary">{(sources || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Sources Analyzed</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-emerald-600">{(requirements || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Requirements</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-amber-600">{(stakeholders || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Stakeholders</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-red-600">{(conflicts || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Conflicts</p>
                  </div>
                </div>
                {brdContent.projectOverview ? (
                  <EditableTextSection
                    sectionKey="projectOverview"
                    content={brdContent.projectOverview}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Project overview will be generated when the pipeline completes." />
                )}
                {/* Project metadata card */}
                {project && (
                  <div className="mt-6 bg-gradient-to-r from-primary/4 to-violet-500/4 rounded-2xl border border-primary/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-primary/60" />
                      <span className="text-[12px] font-medium text-primary/80">Project Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[12px]">
                      <div><span className="text-muted-foreground">Status:</span> <span className="font-medium ml-1 capitalize">{project.status}</span></div>
                      <div><span className="text-muted-foreground">Created:</span> <span className="font-medium ml-1">{new Date(project._creationTime).toLocaleDateString()}</span></div>
                      <div><span className="text-muted-foreground">Requirements:</span> <span className="font-medium ml-1">{project.requirementCount || 0}</span></div>
                      <div><span className="text-muted-foreground">BRD Version:</span> <span className="font-medium ml-1">v{currentDoc?.version || 1}</span></div>
                    </div>
                  </div>
                )}
              </SectionWrapper>
            )}

            {/* ─── BUSINESS OBJECTIVES ────────────────────────────── */}
            {activeSection === "objectives" && (
              <SectionWrapper key="objectives">
                <SectionHeader title="Business Objectives" subtitle="Key goals extracted from project communication" />
                {brdContent.businessObjectives && brdContent.businessObjectives.length > 0 ? (
                  <div className="space-y-4">
                    {brdContent.businessObjectives.map((obj, i) => (
                      <div key={obj.id || i} className="bg-card rounded-2xl border border-border/50 p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[14px] font-bold text-primary">{i + 1}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="text-[15px] font-semibold">{obj.title}</h3>
                              <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{obj.id}</span>
                            </div>
                            <p className="text-[14px] text-muted-foreground leading-relaxed mb-3">{obj.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {obj.metrics && (
                                <span className="text-[12px] text-muted-foreground bg-muted px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                  <BarChart3 className="w-3 h-3" /> {obj.metrics}
                                </span>
                              )}
                              {obj.successCriteria && (
                                <span className="text-[12px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                  <CheckSquare className="w-3 h-3" /> {obj.successCriteria}
                                </span>
                              )}
                              {obj.owner && (
                                <span className="text-[12px] text-primary bg-primary/8 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                  <Users className="w-3 h-3" /> {obj.owner}
                                </span>
                              )}
                            </div>
                            {obj.linkedRequirements && obj.linkedRequirements.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap mt-3">
                                {obj.linkedRequirements.map((reqId) => (
                                  <span key={reqId} className="text-[11px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">{reqId}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Business objectives will be generated when the pipeline completes." />
                )}
              </SectionWrapper>
            )}

            {/* ─── SCOPE DEFINITION ──────────────────────────────── */}
            {activeSection === "scope" && (
              <SectionWrapper key="scope">
                <SectionHeader title="Scope Definition" subtitle="Project boundaries, assumptions, and constraints" />
                {brdContent.scopeDefinition ? (
                  <div className="space-y-4">
                    {brdContent.scopeDefinition.inScope && brdContent.scopeDefinition.inScope.length > 0 && (
                      <ScopeList title="In Scope" items={brdContent.scopeDefinition.inScope} color="emerald" icon={Plus} />
                    )}
                    {brdContent.scopeDefinition.outOfScope && brdContent.scopeDefinition.outOfScope.length > 0 && (
                      <ScopeList title="Out of Scope" items={brdContent.scopeDefinition.outOfScope} color="red" icon={Minus} />
                    )}
                    {brdContent.scopeDefinition.assumptions && brdContent.scopeDefinition.assumptions.length > 0 && (
                      <ScopeList title="Assumptions" items={brdContent.scopeDefinition.assumptions} color="amber" icon={CheckSquare} />
                    )}
                    {brdContent.scopeDefinition.constraints && brdContent.scopeDefinition.constraints.length > 0 && (
                      <ScopeList title="Constraints" items={brdContent.scopeDefinition.constraints} color="blue" icon={Shield} />
                    )}
                  </div>
                ) : (
                  <EmptyState message="Scope definition will be generated when the pipeline completes." />
                )}
              </SectionWrapper>
            )}

            {/* ─── STAKEHOLDER ANALYSIS (prose) ───────────────────── */}
            {activeSection === "stakeholder-analysis" && (
              <SectionWrapper key="stakeholder-analysis">
                <SectionHeader title="Stakeholder Analysis" subtitle="Narrative analysis of stakeholder landscape and dynamics" />
                {brdContent.stakeholderAnalysis ? (
                  <EditableTextSection
                    sectionKey="stakeholderAnalysis"
                    content={brdContent.stakeholderAnalysis}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Stakeholder analysis will be generated when the pipeline completes." />
                )}

                {/* Also show stakeholder cards from live data */}
                {stakeholders && stakeholders.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-[14px] font-semibold mb-4 text-muted-foreground">Identified Stakeholders</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {stakeholders.map((person: any) => {
                        const influenceColor = person.influence === "decision_maker" ? "text-red-600" : person.influence === "influencer" ? "text-amber-600" : person.influence === "contributor" ? "text-blue-600" : "text-muted-foreground";
                        return (
                          <div key={person._id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[14px] font-semibold text-primary shrink-0">
                              {person.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium truncate">{person.name}</p>
                              <p className="text-[12px] text-muted-foreground truncate">{person.role}{person.department ? ` - ${person.department}` : ""}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-[11px] px-2 py-0.5 rounded-full bg-muted capitalize ${influenceColor}`}>
                                {person.influence?.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SectionWrapper>
            )}

            {/* ─── FUNCTIONAL ANALYSIS (prose) ─────────────────────── */}
            {activeSection === "functional-analysis" && (
              <SectionWrapper key="functional-analysis">
                <SectionHeader title="Functional Requirements Analysis" subtitle="Detailed analysis of functional requirement landscape" />
                {/* Functional requirements stats */}
                {requirements && requirements.length > 0 && (() => {
                  const functional = (requirements as any[]).filter((r: any) => r.category === "functional");
                  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
                  functional.forEach((r: any) => { if (byPriority[r.priority as keyof typeof byPriority] !== undefined) byPriority[r.priority as keyof typeof byPriority]++; });
                  return (
                    <div className="grid grid-cols-5 gap-3 mb-6">
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[20px] font-bold text-primary">{functional.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Functional Reqs</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[20px] font-bold text-rose-600">{byPriority.critical}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Critical</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[20px] font-bold text-orange-600">{byPriority.high}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">High</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[20px] font-bold text-amber-600">{byPriority.medium}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Medium</p>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                        <p className="text-[20px] font-bold text-blue-600">{byPriority.low}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Low</p>
                      </div>
                    </div>
                  );
                })()}
                {brdContent.functionalAnalysis ? (
                  <EditableTextSection
                    sectionKey="functionalAnalysis"
                    content={brdContent.functionalAnalysis}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Functional analysis will be generated when the pipeline completes." />
                )}
                {/* Key functional requirements preview */}
                {requirements && (() => {
                  const functional = (requirements as any[]).filter((r: any) => r.category === "functional").slice(0, 5);
                  if (functional.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <h4 className="text-[13px] font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        Key Functional Requirements
                      </h4>
                      <div className="space-y-2">
                        {functional.map((req: any) => (
                          <div key={req._id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{req.requirementId}</span>
                            <span className="text-[12px] font-medium truncate flex-1">{req.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${priorityConfig[req.priority]?.className || ''}`}>{priorityConfig[req.priority]?.label || req.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </SectionWrapper>
            )}

            {/* ─── REQUIREMENTS LIST ───────────────────────────────── */}
            {activeSection === "requirements" && (
              <SectionWrapper key="requirements">
                <SectionHeader title="Requirements List" subtitle={`${(requirements || []).length} requirements extracted from sources`} />
                {(requirements || []).length > 0 ? (
                  <div className="space-y-3">
                    {(requirements as any[]).map((req: any) => (
                      <RequirementCard key={req._id} req={req as unknown as ReqRecord} isSelected={selectedReqId === req._id} onClick={() => setSelectedReqId(req._id === selectedReqId ? null : req._id)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No requirements extracted yet." />
                )}
              </SectionWrapper>
            )}

            {/* ─── NON-FUNCTIONAL ANALYSIS (prose) ─────────────────── */}
            {activeSection === "nonfunctional-analysis" && (
              <SectionWrapper key="nonfunctional-analysis">
                <SectionHeader title="Non-Functional Requirements Analysis" subtitle="Performance, security, scalability, and compliance analysis" />
                {/* Non-functional requirements stats */}
                {requirements && requirements.length > 0 && (() => {
                  const nfr = (requirements as any[]).filter((r: any) => r.category === "non_functional" || r.category === "security" || r.category === "performance" || r.category === "compliance");
                  const catCounts: Record<string, number> = {};
                  nfr.forEach((r: any) => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
                  return (
                    <div className="mb-6">
                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                          <p className="text-[20px] font-bold text-violet-600">{nfr.length}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Non-Functional</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                          <p className="text-[20px] font-bold text-red-600">{catCounts.security || 0}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Security</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                          <p className="text-[20px] font-bold text-emerald-600">{catCounts.performance || 0}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Performance</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                          <p className="text-[20px] font-bold text-slate-600">{catCounts.compliance || 0}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Compliance</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                          <p className="text-[20px] font-bold text-cyan-600">{catCounts.non_functional || 0}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">General NFR</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {brdContent.nonFunctionalAnalysis ? (
                  <EditableTextSection
                    sectionKey="nonFunctionalAnalysis"
                    content={brdContent.nonFunctionalAnalysis}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Non-functional analysis will be generated when the pipeline completes." />
                )}
                {/* Key non-functional requirements preview */}
                {requirements && (() => {
                  const nfr = (requirements as any[]).filter((r: any) => r.category === "non_functional" || r.category === "security" || r.category === "performance" || r.category === "compliance").slice(0, 5);
                  if (nfr.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <h4 className="text-[13px] font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Key Non-Functional Requirements
                      </h4>
                      <div className="space-y-2">
                        {nfr.map((req: any) => (
                          <div key={req._id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{req.requirementId}</span>
                            <span className="text-[12px] font-medium truncate flex-1">{req.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: (categoryConfig[req.category]?.color || '#64748B') + '15', color: categoryConfig[req.category]?.color || '#64748B' }}>{categoryConfig[req.category]?.label || req.category}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </SectionWrapper>
            )}

            {/* ─── DECISION ANALYSIS ──────────────────────────────── */}
            {activeSection === "decision-analysis" && (
              <SectionWrapper key="decision-analysis">
                <SectionHeader title="Decision Log Analysis" subtitle="Analysis of decisions, governance patterns, and outstanding items" />
                {/* Decision context stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-primary">{brdContent.intelligenceSummary?.totalDecisions ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Decisions Logged</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-emerald-600">{(requirements || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Requirements Impacted</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className="text-[20px] font-bold text-amber-600">{(stakeholders || []).length}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Stakeholders Involved</p>
                  </div>
                </div>
                {brdContent.decisionAnalysis ? (
                  <EditableTextSection
                    sectionKey="decisionAnalysis"
                    content={brdContent.decisionAnalysis}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Decision analysis will be generated when the pipeline completes." />
                )}
              </SectionWrapper>
            )}

            {/* ─── RISK ASSESSMENT ────────────────────────────────── */}
            {activeSection === "risk-assessment" && (
              <SectionWrapper key="risk-assessment">
                <SectionHeader title="Risk & Conflict Assessment" subtitle="Identified risks, conflicts, and mitigation strategies" />
                {/* Risk/Conflict severity grid */}
                {conflicts && conflicts.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
                      <p className="text-[20px] font-bold text-red-600">{conflicts.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Total Conflicts</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200/40 dark:border-red-800/30 p-4 text-center">
                      <p className="text-[20px] font-bold text-red-700 dark:text-red-400">{conflicts.filter((c: any) => c.severity === 'critical').length}</p>
                      <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">Critical</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200/40 dark:border-orange-800/30 p-4 text-center">
                      <p className="text-[20px] font-bold text-orange-700 dark:text-orange-400">{conflicts.filter((c: any) => c.severity === 'major').length}</p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">Major</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl border border-yellow-200/40 dark:border-yellow-800/30 p-4 text-center">
                      <p className="text-[20px] font-bold text-yellow-700 dark:text-yellow-400">{conflicts.filter((c: any) => c.severity === 'minor').length}</p>
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">Minor</p>
                    </div>
                  </div>
                )}
                {brdContent.riskAssessment ? (
                  <EditableTextSection
                    sectionKey="riskAssessment"
                    content={brdContent.riskAssessment}
                    editingSection={editingSection}
                    editBuffer={editBuffer}
                    isSaving={isSaving}
                    onStartEdit={startEditing}
                    onCancel={cancelEditing}
                    onSave={saveEdit}
                    onChangeBuffer={setEditBuffer}
                  />
                ) : (
                  <EmptyState message="Risk assessment will be generated when the pipeline completes." />
                )}
                {/* Related conflicts preview */}
                {conflicts && conflicts.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-[13px] font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Related Conflicts ({conflicts.length})
                    </h4>
                    <div className="space-y-2">
                      {conflicts.slice(0, 4).map((conflict: any) => {
                        const sevStyle: Record<string, string> = { critical: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400", major: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400", minor: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400" };
                        return (
                          <div key={conflict._id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${sevStyle[conflict.severity] || sevStyle.minor}`}>{conflict.severity}</span>
                            <span className="text-[12px] font-medium truncate flex-1">{conflict.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${conflict.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{conflict.status || 'open'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SectionWrapper>
            )}

            {/* ─── CONFLICTS (Improved clarity) ─────────────────── */}
            {activeSection === "conflicts" && (
              <SectionWrapper key="conflicts">
                <SectionHeader title="Detected Conflicts" subtitle="Contradictions and tensions found between requirements or stakeholder expectations" />
                {conflicts && conflicts.length > 0 ? (
                  <div className="space-y-4">
                    {/* Severity summary */}
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div className="bg-red-50 rounded-xl border border-red-200/40 p-4 text-center">
                        <p className="text-[20px] font-bold text-red-700">{conflicts.filter((c: any) => c.severity === 'critical').length}</p>
                        <p className="text-[11px] text-red-600 font-medium">Critical</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl border border-orange-200/40 p-4 text-center">
                        <p className="text-[20px] font-bold text-orange-700">{conflicts.filter((c: any) => c.severity === 'major').length}</p>
                        <p className="text-[11px] text-orange-600 font-medium">Major</p>
                      </div>
                      <div className="bg-yellow-50 rounded-xl border border-yellow-200/40 p-4 text-center">
                        <p className="text-[20px] font-bold text-yellow-700">{conflicts.filter((c: any) => c.severity === 'minor').length}</p>
                        <p className="text-[11px] text-yellow-600 font-medium">Minor</p>
                      </div>
                    </div>

                    {conflicts.map((conflict: any) => (
                      <ConflictCard key={conflict._id} conflict={conflict} requirements={requirements as any[]} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No conflicts detected - or pipeline has not run yet." />
                )}
              </SectionWrapper>
            )}

            {/* ─── TRACEABILITY MATRIX ─────────────────────────────── */}
            {activeSection === "traceability" && (
              <SectionWrapper key="traceability">
                <SectionHeader title="Traceability Matrix" subtitle="Every requirement traced back to its source" />
                {requirements && requirements.length > 0 ? (
                  <TraceabilityTable
                    requirements={requirements as unknown as ReqRecord[]}
                    sources={sources as any[] || []}
                    traceGraph={traceGraph || null}
                    onSelect={(id) => setSelectedReqId(id)}
                  />
                ) : (
                  <EmptyState message="No requirements to trace yet." />
                )}
              </SectionWrapper>
            )}

            {/* ─── CONFIDENCE REPORT ──────────────────────────────── */}
            {activeSection === "confidence" && (
              <SectionWrapper key="confidence">
                <SectionHeader title="Confidence & Coverage Report" subtitle="Extraction quality assessment and recommendations" />
                {brdContent.confidenceReport ? (
                  <div className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border/50 p-6">
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                          <p className="text-[28px] font-bold text-primary">{brdContent.confidenceReport.overallScore ? `${Math.round(Number(brdContent.confidenceReport.overallScore) * 100)}%` : "—"}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Overall Score</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[28px] font-bold text-emerald-600">{brdContent.confidenceReport.highConfidence ?? 0}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">High Confidence</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[28px] font-bold text-amber-600">{brdContent.confidenceReport.mediumConfidence ?? 0}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Medium</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[28px] font-bold text-red-600">{brdContent.confidenceReport.lowConfidence ?? 0}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Low Confidence</p>
                        </div>
                      </div>
                    </div>
                    {brdContent.confidenceReport.coverageGaps && brdContent.confidenceReport.coverageGaps.length > 0 && (
                      <div className="bg-amber-50/50 rounded-2xl border border-amber-200/30 p-6">
                        <h4 className="text-[14px] font-semibold text-amber-800 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Coverage Gaps
                        </h4>
                        <div className="space-y-2">
                          {brdContent.confidenceReport.coverageGaps.map((gap, i) => (
                            <p key={i} className="text-[13px] text-amber-700 flex items-start gap-2">
                              <span className="shrink-0 mt-0.5">•</span>
                              {gap}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {brdContent.confidenceReport.recommendations && brdContent.confidenceReport.recommendations.length > 0 && (
                      <div className="bg-primary/4 rounded-2xl border border-primary/10 p-6">
                        <h4 className="text-[14px] font-semibold text-primary mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Recommendations
                        </h4>
                        <div className="space-y-2">
                          {brdContent.confidenceReport.recommendations.map((rec, i) => (
                            <p key={i} className="text-[13px] text-foreground/75 flex items-start gap-2">
                              <span className="text-primary shrink-0 mt-0.5">→</span>
                              {rec}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState message="Confidence report will be generated when the pipeline completes." />
                )}
              </SectionWrapper>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Requirement detail panel */}
      <AnimatePresence>
        {selectedRequirement && (
          <RequirementDetailPanel requirement={selectedRequirement as unknown as ReqRecord} onClose={() => setSelectedReqId(null)} sources={sources || []} />
        )}
      </AnimatePresence>

      {/* Export & Share Modal */}
      <ExportShareModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={project.name}
        version={currentDoc?.version || 1}
        projectId={project._id}
        brdContent={brdContent}
        requirements={requirements as any[] || []}
        stakeholders={stakeholders as any[] || []}
        conflicts={conflicts as any[] || []}
        sources={sources as any[] || []}
      />
    </div>
  );
}

// ─── Shared Sub-components ──────────────────────────────────────────────────

function SectionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[22px] tracking-[-0.02em] font-semibold">{title}</h2>
      <p className="text-[14px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border/50 p-12 text-center">
      <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-[14px] text-muted-foreground">{message}</p>
    </div>
  );
}

function EditableTextSection({
  sectionKey,
  content,
  editingSection,
  editBuffer,
  isSaving,
  onStartEdit,
  onCancel,
  onSave,
  onChangeBuffer,
}: {
  sectionKey: string;
  content: string;
  editingSection: string | null;
  editBuffer: string;
  isSaving: boolean;
  onStartEdit: (key: string, value: string) => void;
  onCancel: () => void;
  onSave: (key: string) => void;
  onChangeBuffer: (val: string) => void;
}) {
  const isEditing = editingSection === sectionKey;

  // Helper: render inline parts with bold support
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.+?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground/90">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Parse paragraphs into rendered blocks
  const renderContent = (text: string) => {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return (
      <div className="space-y-4">
        {paragraphs.map((para, pi) => {
          const trimmed = para.trim();

          // Heading detection: paragraph that is JUST **Bold Text** (sub-heading)
          const headingMatch = trimmed.match(/^\*\*(.+?)\*\*:?$/);
          if (headingMatch && trimmed.length < 120) {
            return (
              <h4 key={pi} className="text-[14px] font-semibold text-foreground/90 pt-3 pb-1 border-b border-border/30 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-primary/50" />
                {headingMatch[1]}
              </h4>
            );
          }

          // Bullet list block
          if (trimmed.split("\n").every(l => l.trim().startsWith("- ") || l.trim().startsWith("• ") || l.trim() === "")) {
            const items = trimmed.split("\n").filter(l => l.trim().startsWith("- ") || l.trim().startsWith("• "));
            return (
              <ul key={pi} className="space-y-1.5 ml-1">
                {items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2.5 text-[13.5px] leading-[1.75] text-foreground/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2.5 shrink-0" />
                    <span>{renderInline(item.replace(/^[-•]\s*/, ""))}</span>
                  </li>
                ))}
              </ul>
            );
          }

          // Numbered list block (1. item, 2. item or 1) item)
          const lines = trimmed.split("\n");
          if (lines.length >= 2 && lines.filter(l => l.trim()).every(l => /^\s*\d+[.)]\s/.test(l.trim()))) {
            const items = lines.filter(l => /^\s*\d+[.)]\s/.test(l.trim()));
            return (
              <div key={pi} className="space-y-2 ml-1">
                {items.map((item, ii) => {
                  const itemText = item.replace(/^\s*\d+[.)]\s*/, "");
                  return (
                    <div key={ii} className="flex items-start gap-3 text-[13.5px] leading-[1.75] text-foreground/80">
                      <span className="w-6 h-6 rounded-lg bg-primary/8 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{ii + 1}</span>
                      <span>{renderInline(itemText)}</span>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Regular paragraph — render with inline bold support
          return (
            <p key={pi} className="text-[13.5px] leading-[1.85] text-foreground/80">
              {renderInline(trimmed.replace(/\n/g, " "))}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 group relative">
      {/* Decorative accent line */}
      <div className="absolute top-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
      {!isEditing && (
        <button
          onClick={() => onStartEdit(sectionKey, content)}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          title="Edit section"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editBuffer}
            onChange={(e) => onChangeBuffer(e.target.value)}
            className="w-full min-h-[200px] text-[14px] leading-[1.8] text-foreground/85 bg-muted/30 border border-border rounded-xl p-4 resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(sectionKey)}
              disabled={isSaving}
              className="px-3 py-1.5 text-[12px] bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      ) : (
        renderContent(content)
      )}
    </div>
  );
}

function ScopeList({ title, items, color, icon: Icon }: { title: string; items: string[]; color: "emerald" | "red" | "amber" | "blue"; icon: any }) {
  const colorMap = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200/30", text: "text-emerald-700", icon: "text-emerald-500" },
    red: { bg: "bg-red-50", border: "border-red-200/30", text: "text-red-700", icon: "text-red-500" },
    amber: { bg: "bg-amber-50", border: "border-amber-200/30", text: "text-amber-700", icon: "text-amber-500" },
    blue: { bg: "bg-blue-50", border: "border-blue-200/30", text: "text-blue-700", icon: "text-blue-500" },
  };
  const c = colorMap[color];
  return (
    <div className={`${c.bg}/50 rounded-2xl border ${c.border} p-6`}>
      <h4 className={`text-[14px] font-semibold ${c.text} mb-3 flex items-center gap-2`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full ${c.bg.replace('/50', '')} mt-2 shrink-0`} style={{ backgroundColor: c.icon.includes('emerald') ? '#10B981' : c.icon.includes('red') ? '#EF4444' : c.icon.includes('amber') ? '#F59E0B' : '#3B82F6' }} />
            <p className={`text-[13px] ${c.text} leading-relaxed`}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <div className={`bg-gradient-to-br ${bg} rounded-xl border border-border/30 p-5`}>
      <p className="text-[24px] tracking-[-0.02em] font-bold" style={{ color }}>{value}</p>
      <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ─── Requirement Card ───────────────────────────────────────────────────────

function RequirementCard({ req, isSelected, onClick }: { req: ReqRecord; isSelected: boolean; onClick: () => void }) {
  const priority = priorityConfig[req.priority] || priorityConfig.medium;
  const status = statusConfig[req.status] || statusConfig.discovered;
  const category = categoryConfig[req.category];
  const PriorityIcon = priority.icon;

  return (
    <div
      className={`bg-card rounded-2xl border p-5 cursor-pointer group transition-all duration-200 ${isSelected ? "border-primary/30 shadow-[0_0_0_2px_rgba(107,122,232,0.08)]" : "border-border/50 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{req.requirementId}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${priority.className}`}>
            <PriorityIcon className="w-3 h-3" />
            {priority.label}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
          {category && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + "15", color: category.color }}>
              {category.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${req.confidenceScore >= 0.8 ? "bg-emerald-50 text-emerald-700" : req.confidenceScore >= 0.5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
            }`}>
            {Math.round(req.confidenceScore * 100)}%
          </span>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <h4 className="text-[14px] font-medium mb-2">{req.title}</h4>
      <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">{req.description}</p>
    </div>
  );
}

// ─── Requirement Detail Panel ───────────────────────────────────────────────

function RequirementDetailPanel({ requirement, onClose, sources }: { requirement: ReqRecord; onClose: () => void; sources: any[] }) {
  const priority = priorityConfig[requirement.priority] || priorityConfig.medium;
  const status = statusConfig[requirement.status] || statusConfig.discovered;
  const PriorityIcon = priority.icon;
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);

  // Find the linked source for this requirement
  const linkedSource = useMemo(() => {
    if (!(requirement as any).sourceId) return null;
    return sources.find((s: any) => s._id === (requirement as any).sourceId) || null;
  }, [requirement, sources]);

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="w-[400px] shrink-0 border-l border-border/50 bg-card overflow-y-auto"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[12px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{requirement.requirementId}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <h3 className="text-[18px] font-semibold mb-4">{requirement.title}</h3>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className={`text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 ${priority.className}`}>
            <PriorityIcon className="w-3 h-3" />
            {priority.label} Priority
          </span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full ${requirement.confidenceScore >= 0.8 ? "bg-emerald-50 text-emerald-700" : requirement.confidenceScore >= 0.5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
            }`}>
            {Math.round(requirement.confidenceScore * 100)}% confidence
          </span>
        </div>

        <div className="mb-6">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Description</label>
          <p className="text-[14px] leading-[1.7] text-foreground/85">{requirement.description}</p>
        </div>

        {/* Clickable Source Excerpt */}
        {requirement.sourceExcerpt && (
          <div className="mb-6">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3 block">Source Evidence</label>
            <button
              onClick={() => linkedSource && setShowSourceDrawer(true)}
              className={`w-full text-left bg-muted/30 rounded-xl border border-border/30 p-4 transition-all ${linkedSource
                  ? "hover:border-primary/30 hover:bg-primary/[0.03] cursor-pointer group"
                  : ""
                }`}
            >
              <div className="border-l-2 border-primary/30 pl-4 py-1">
                <p className="text-[13px] leading-relaxed text-foreground/80 italic">&ldquo;{requirement.sourceExcerpt}&rdquo;</p>
              </div>
              {linkedSource && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-primary/70 group-hover:text-primary transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  <span className="font-medium">{linkedSource.name}</span>
                  <span className="text-muted-foreground">({linkedSource.type?.replace(/_/g, " ")})</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 group-hover:text-primary/50">Click to view source →</span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Source Content Drawer */}
        <AnimatePresence>
          {showSourceDrawer && linkedSource && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex justify-end"
              onClick={() => setShowSourceDrawer(false)}
            >
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
              <motion.div
                initial={{ x: 500 }}
                animate={{ x: 0 }}
                exit={{ x: 500 }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="relative w-[560px] bg-card border-l border-border shadow-2xl flex flex-col h-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-[14px] font-semibold">{linkedSource.name}</h4>
                        <p className="text-[11px] text-muted-foreground capitalize">{linkedSource.type?.replace(/_/g, " ")} · {linkedSource.metadata?.wordCount || 0} words</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSourceDrawer(false)}
                      className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Metadata pills */}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {linkedSource.metadata?.author && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        Author: {linkedSource.metadata.author}
                      </span>
                    )}
                    {linkedSource.metadata?.channel && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
                        {linkedSource.metadata.channel}
                      </span>
                    )}
                    {linkedSource.metadata?.integrationAppId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        via {linkedSource.metadata.integrationAppId}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      Relevance: {Math.round((linkedSource.relevanceScore || 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Cited Excerpt Highlight */}
                <div className="px-6 py-3 bg-primary/[0.04] border-b border-primary/10 shrink-0">
                  <p className="text-[10px] text-primary font-medium uppercase tracking-wider mb-1">Cited Excerpt for {requirement.requirementId}</p>
                  <p className="text-[12px] leading-relaxed text-primary/80 italic">&ldquo;{requirement.sourceExcerpt}&rdquo;</p>
                </div>

                {/* Full Source Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Full Source Content</p>
                  <HighlightedSourceContent
                    content={linkedSource.content || ""}
                    excerpt={requirement.sourceExcerpt}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {requirement.extractionReasoning && (
          <div className="mb-6">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3 block">AI Extraction Reasoning</label>
            <div className="bg-primary/4 rounded-xl border border-primary/10 p-4">
              <p className="text-[13px] leading-relaxed text-foreground/75">{requirement.extractionReasoning}</p>
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2 block">Category</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <span
                key={key}
                className={`text-[11px] px-3 py-1.5 rounded-lg border capitalize transition-colors ${requirement.category === key ? "border-primary/30 bg-primary/8 text-primary" : "border-border/30 text-muted-foreground"
                  }`}
              >
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Renders source content with the cited excerpt highlighted */
function HighlightedSourceContent({ content, excerpt }: { content: string; excerpt: string }) {
  // Find the exact excerpt in the content (fuzzy: try substring match)
  const excerptClean = excerpt.replace(/[…\u2026]/g, "...").trim();
  const idx = content.toLowerCase().indexOf(excerptClean.toLowerCase().slice(0, 50));

  if (idx === -1) {
    // Fallback: just render plain content
    return (
      <pre className="text-[12px] leading-[1.8] text-foreground/75 whitespace-pre-wrap font-sans">{content}</pre>
    );
  }

  // Find the end of the excerpt in source
  // Use a longer search to get the best match
  let endIdx = idx + excerptClean.length;
  // Try to find the exact end
  const endSearch = excerptClean.slice(-40);
  const possibleEnd = content.toLowerCase().indexOf(endSearch.toLowerCase(), idx);
  if (possibleEnd > idx) {
    endIdx = possibleEnd + endSearch.length;
  }

  const before = content.slice(0, idx);
  const highlighted = content.slice(idx, endIdx);
  const after = content.slice(endIdx);

  return (
    <pre className="text-[12px] leading-[1.8] text-foreground/75 whitespace-pre-wrap font-sans">
      {before}
      <mark className="bg-primary/15 text-primary border-b-2 border-primary/30 px-0.5 rounded-sm">{highlighted}</mark>
      {after}
    </pre>
  );
}

// ─── Conflict Card ──────────────────────────────────────────────────────────

function ConflictCard({ conflict, requirements }: { conflict: any; requirements: any[] }) {
  const severityMap: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
    critical: { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-200/60", icon: "🔴" },
    major: { label: "Major", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200/60", icon: "🟠" },
    minor: { label: "Minor", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200/60", icon: "🟡" },
  };
  const sev = severityMap[conflict.severity] || severityMap.minor;

  // Resolve requirement IDs to readable titles
  const involvedReqs = (conflict.requirementIds || [])
    .map((rid: any) => requirements.find((r: any) => r._id === rid))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${sev.border} ${sev.bg} p-5 shadow-sm`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[18px] mt-0.5">{sev.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-[14px] font-semibold ${sev.color}`}>{conflict.title}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sev.color} ${sev.bg} border ${sev.border}`}>
              {sev.label}
            </span>
            {conflict.status === "resolved" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60">
                Resolved
              </span>
            )}
          </div>
          <p className="text-[13px] leading-[1.7] text-foreground/80">{conflict.description}</p>
        </div>
      </div>

      {/* Show which requirements are in conflict */}
      {involvedReqs.length > 0 && (
        <div className="ml-8 mt-2 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Conflicting Requirements</p>
          <div className="space-y-1.5">
            {involvedReqs.map((req: any) => (
              <div key={req._id} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border border-border">
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">{req.requirementId}</span>
                <span className="text-[12px] text-foreground/80 truncate">{req.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${req.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                    req.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' :
                      req.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' :
                        'bg-muted text-muted-foreground'
                  }`}>{req.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution */}
      {conflict.resolution && (
        <div className="ml-8 mt-2 bg-emerald-50/80 rounded-xl border border-emerald-200/40 p-3">
          <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-1">Resolution</p>
          <p className="text-[12px] text-emerald-800 leading-[1.6]">{conflict.resolution}</p>
        </div>
      )}

      {/* Conflict ID & timestamp */}
      <div className="ml-8 mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        {conflict.conflictId && <span className="font-mono">ID: {conflict.conflictId}</span>}
        {conflict.detectedAt && (
          <span>Detected {new Date(conflict.detectedAt).toLocaleDateString()}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Traceability Table ─────────────────────────────────────────────────────

function TraceabilityTable({
  requirements: reqs,
  sources,
  traceGraph,
  onSelect,
}: {
  requirements: ReqRecord[];
  sources: any[];
  traceGraph: { nodes: any[]; edges: any[] } | null;
  onSelect: (id: string) => void;
}) {
  const [catFilter, setCatFilter] = useState<string>("all");

  const categories = useMemo(() => Array.from(new Set(reqs.map((r) => r.category))), [reqs]);
  const filtered = useMemo(() => (catFilter === "all" ? reqs : reqs.filter((r) => r.category === catFilter)), [reqs, catFilter]);

  // Build source lookup map: reqId → linked sources
  const reqToSources = useMemo(() => {
    const map: Record<string, { id: string; label: string; relationship: string; strength: number }[]> = {};
    if (!traceGraph) return map;
    for (const edge of traceGraph.edges) {
      // source → requirement or requirement → source
      const sourceNode = traceGraph.nodes.find((n) => n.id === edge.source && n.type === "source");
      const targetNode = traceGraph.nodes.find((n) => n.id === edge.target && n.type === "requirement");
      if (sourceNode && targetNode) {
        if (!map[targetNode.id]) map[targetNode.id] = [];
        map[targetNode.id].push({ id: sourceNode.id, label: sourceNode.label, relationship: edge.relationship, strength: edge.strength });
      }
      // Also check reverse (requirement → source)
      const sourceNode2 = traceGraph.nodes.find((n) => n.id === edge.target && n.type === "source");
      const targetNode2 = traceGraph.nodes.find((n) => n.id === edge.source && n.type === "requirement");
      if (sourceNode2 && targetNode2) {
        if (!map[targetNode2.id]) map[targetNode2.id] = [];
        map[targetNode2.id].push({ id: sourceNode2.id, label: sourceNode2.label, relationship: edge.relationship, strength: edge.strength });
      }
    }
    return map;
  }, [traceGraph]);

  // Also build a simple fallback: if no trace links exist, try to match by sourceId on requirements
  const sourceLookup = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of sources) {
      map[s._id] = s;
    }
    return map;
  }, [sources]);

  const hasTraceLinks = Object.keys(reqToSources).length > 0;

  return (
    <div>
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 mb-5 flex-wrap">
        <button
          onClick={() => setCatFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-[12px] transition-all font-medium ${catFilter === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          All ({reqs.length})
        </button>
        {categories.map((cat) => {
          const cfg = categoryConfig[cat];
          const count = reqs.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-[12px] transition-all font-medium capitalize ${catFilter === cat ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {cfg?.label || cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
          <p className="text-[18px] font-bold text-primary">{reqs.length}</p>
          <p className="text-[10px] text-muted-foreground">Requirements</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
          <p className="text-[18px] font-bold text-amber-600">{sources.length}</p>
          <p className="text-[10px] text-muted-foreground">Sources</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
          <p className="text-[18px] font-bold text-emerald-600">{hasTraceLinks ? Object.keys(reqToSources).length : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Linked Requirements</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_80px_90px_1fr] gap-3 px-5 py-3 bg-muted/30 border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          <span>ID</span>
          <span>Requirement</span>
          <span>Priority</span>
          <span>Category</span>
          <span>Source Links</span>
        </div>
        <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
          {filtered.map((req) => {
            const p = priorityConfig[req.priority] || priorityConfig.medium;
            const PIcon = p.icon;
            const cat = categoryConfig[req.category];
            const linkedSources = reqToSources[req._id] || [];
            // Fallback: if req has sourceId field
            const fallbackSource = (req as any).sourceId ? sourceLookup[(req as any).sourceId] : null;
            return (
              <div key={req._id} onClick={() => onSelect(req._id)} className="grid grid-cols-[80px_1fr_80px_90px_1fr] gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors items-start">
                <span className="text-[11px] font-mono text-muted-foreground mt-1">{req.requirementId}</span>
                <div className="min-w-0"><p className="text-[13px] truncate">{req.title}</p></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mt-0.5 ${p.className}`}>
                  <PIcon className="w-2.5 h-2.5" />{p.label}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full w-fit capitalize mt-0.5" style={{ backgroundColor: (cat?.color || "#64748B") + "15", color: cat?.color || "#64748B" }}>
                  {cat?.label || req.category}
                </span>
                <div className="min-w-0">
                  {linkedSources.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {linkedSources.map((ls, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/30" title={ls.relationship}>
                          <Link2 className="w-2.5 h-2.5" />
                          {ls.label.length > 25 ? ls.label.slice(0, 25) + "…" : ls.label}
                          <span className="text-amber-500 ml-0.5">{Math.round(ls.strength * 100)}%</span>
                        </span>
                      ))}
                    </div>
                  ) : fallbackSource ? (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200/30">
                      <Link2 className="w-2.5 h-2.5" />
                      {fallbackSource.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50 italic">No source linked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground text-right">{filtered.length} of {reqs.length} requirements shown</p>
    </div>
  );
}
