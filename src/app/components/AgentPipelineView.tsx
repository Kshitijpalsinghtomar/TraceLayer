/**
 * AgentPipelineView — Real-time terminal-style view of AI agents working
 * Shows extraction pipeline running with live logs from Convex.
 * Fully integrated with the Integrations Hub for data syncing.
 */
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Cpu,
  Database,
  Users,
  FileText,
  GitBranch,
  Zap,
  Clock,
  ChevronRight,
  Settings2,
  KeyRound,
  Loader2,
  Sparkles,
  Beaker,
  RotateCcw,
  StopCircle,
  RefreshCw,
  Puzzle,
  PlugZap,
  History,
  ChevronDown,
  Network,
  Download,
  Trash2,
  Activity,
  SlidersHorizontal,
} from "lucide-react";

// ─── Agent Config ─────────────────────────────────────────────────────────────
const AGENT_ICONS: Record<string, typeof Cpu> = {
  orchestrator: Cpu,
  ingestion_agent: Database,
  classification_agent: GitBranch,
  requirement_agent: FileText,
  stakeholder_agent: Users,
  decision_agent: Zap,
  timeline_agent: Clock,
  conflict_agent: AlertTriangle,
  traceability_agent: Network,
  document_agent: FileText,
  integration_agent: PlugZap,
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "#6366F1",
  ingestion_agent: "#F59E0B",
  classification_agent: "#8B5CF6",
  requirement_agent: "#3B82F6",
  stakeholder_agent: "#10B981",
  decision_agent: "#F97316",
  timeline_agent: "#06B6D4",
  conflict_agent: "#EF4444",
  traceability_agent: "#EC4899",
  document_agent: "#22C55E",
  integration_agent: "#8B5CF6",
};

const LEVEL_STYLES: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  info: { color: "#64748B", icon: ChevronRight },
  processing: { color: "#3B82F6", icon: Loader2 },
  success: { color: "#22C55E", icon: CheckCircle2 },
  warning: { color: "#F59E0B", icon: AlertTriangle },
  error: { color: "#EF4444", icon: XCircle },
};

const PIPELINE_STAGES = [
  { key: "ingesting", label: "Ingestion", agent: "ingestion_agent" },
  { key: "classifying", label: "Classification", agent: "classification_agent" },
  { key: "extracting_requirements", label: "Requirements", agent: "requirement_agent" },
  { key: "extracting_stakeholders", label: "Stakeholders", agent: "stakeholder_agent" },
  { key: "extracting_decisions", label: "Decisions", agent: "decision_agent" },
  { key: "extracting_timeline", label: "Timeline", agent: "timeline_agent" },
  { key: "detecting_conflicts", label: "Conflicts", agent: "conflict_agent" },
  { key: "building_traceability", label: "Traceability", agent: "traceability_agent" },
  { key: "generating_documents", label: "Documents", agent: "document_agent" },
];

export function AgentPipelineView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const terminalRef = useRef<HTMLDivElement>(null);

  // ─── Convex Queries ─────────────────────────────────────────────────────
  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const latestRun = useQuery(
    api.pipeline.getLatestRun,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const logs = useQuery(
    api.pipeline.getLogsForRun,
    latestRun ? { extractionRunId: latestRun._id } : "skip"
  );
  const runHistory = useQuery(
    api.pipeline.listRunsForProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);
  const connectedIntegrations = useQuery(api.integrations.listConnected);
  const sources = useQuery(
    api.sources.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const pipelineStatus = useQuery(
    api.pipeline.isPipelineRunning,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // ─── Convex Mutations / Actions ──────────────────────────────────────────
  const runPipeline = useAction(api.extraction.runExtractionPipeline);
  const syncAndRun = useAction(api.integrationSync.syncAndRunPipeline);
  const syncAll = useAction(api.integrationSync.syncAllToProject);
  const cancelPipeline = useMutation(api.pipeline.cancelPipeline);
  const clearRunHistoryMut = useMutation(api.pipeline.clearRunHistory);
  const clearExtractionData = useMutation(api.projects.clearExtractionData);
  const refreshCounts = useMutation(api.projects.refreshCounts);
  const diagnostics = useQuery(
    api.pipeline.getDiagnostics,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // ─── Local State ─────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic">("gemini");
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [usingStoredKey, setUsingStoredKey] = useState(false);
  const [regenerateMode, setRegenerateMode] = useState(false);
  const [syncWithIntegrations, setSyncWithIntegrations] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, "pass" | "fail" | "running"> | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Auto-load stored API key for selected provider
  const storedKey = useQuery(api.apiKeys.getKeyForProvider, { provider });

  useEffect(() => {
    if (storedKey && !apiKey) {
      setApiKey(storedKey);
      setUsingStoredKey(true);
    }
  }, [storedKey, provider]);

  useEffect(() => {
    if (storedKey) {
      setApiKey(storedKey);
      setUsingStoredKey(true);
    } else {
      setApiKey("");
      setUsingStoredKey(false);
    }
  }, [provider, storedKey]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Detect running state from server
  useEffect(() => {
    if (pipelineStatus?.isRunning) {
      setIsRunning(true);
    } else if (latestRun && ["completed", "failed", "cancelled"].includes(latestRun.status)) {
      setIsRunning(false);
    }
  }, [pipelineStatus, latestRun]);

  // ─── Computed Values ──────────────────────────────────────────────────────
  const connectedCount = connectedIntegrations?.length ?? 0;
  const sourceCount = sources?.length ?? 0;
  const integrationSources = useMemo(
    () => (sources || []).filter((s: any) => s.metadata?.integrationAppId),
    [sources]
  );

  const currentStageIndex = PIPELINE_STAGES.findIndex(
    (s) => s.key === latestRun?.status
  );

  const completedRuns = useMemo(
    () => (runHistory || []).filter((r) => r.status === "completed"),
    [runHistory]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleStartPipeline = useCallback(async () => {
    if (!apiKey || !projectId) return;
    setIsRunning(true);
    try {
      if (syncWithIntegrations && connectedCount > 0) {
        await syncAndRun({
          projectId: projectId as Id<"projects">,
          provider,
          apiKey,
          regenerate: regenerateMode,
        });
      } else {
        await runPipeline({
          projectId: projectId as Id<"projects">,
          provider,
          apiKey,
          regenerate: regenerateMode,
        });
      }
    } catch (e) {
      console.error("Pipeline failed:", e);
    } finally {
      setIsRunning(false);
    }
  }, [apiKey, projectId, provider, syncWithIntegrations, connectedCount, regenerateMode, syncAndRun, runPipeline]);

  const handleCancel = useCallback(async () => {
    if (!projectId) return;
    await cancelPipeline({ projectId: projectId as Id<"projects"> });
    setIsRunning(false);
  }, [projectId, cancelPipeline]);

  const handleSyncIntegrations = useCallback(async () => {
    if (!projectId) return;
    setIsSyncing(true);
    try {
      await syncAll({ projectId: projectId as Id<"projects"> });
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [projectId, syncAll]);

  const handleClearData = useCallback(async () => {
    if (!projectId) return;
    setIsClearing(true);
    try {
      await clearExtractionData({ projectId: projectId as Id<"projects"> });
      await refreshCounts({ projectId: projectId as Id<"projects"> });
    } catch (e) {
      console.error("Clear failed:", e);
    } finally {
      setIsClearing(false);
    }
  }, [projectId, clearExtractionData, refreshCounts]);

  const handleClearHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      await clearRunHistoryMut({ projectId: projectId as Id<"projects">, keepLatest: 1 });
    } catch (e) {
      console.error("Clear history failed:", e);
    }
  }, [projectId, clearRunHistoryMut]);

  const handleRunTests = useCallback(async () => {
    setIsRunningTests(true);
    setTestResults({});
    const tests = [
      { key: "apiKey", label: "API Key" },
      { key: "sources", label: "Sources" },
      { key: "integrations", label: "Integrations" },
      { key: "project", label: "Project State" },
      { key: "pipeline", label: "Pipeline Health" },
    ];
    for (const test of tests) {
      setTestResults((prev) => ({ ...prev, [test.key]: "running" as const }));
      await new Promise((r) => setTimeout(r, 500));
      let result: "pass" | "fail" = "pass";
      if (test.key === "apiKey") result = apiKey ? "pass" : "fail";
      else if (test.key === "sources") result = sourceCount > 0 ? "pass" : "fail";
      else if (test.key === "integrations") result = connectedCount > 0 || sourceCount > 0 ? "pass" : "fail";
      else if (test.key === "project") result = project ? "pass" : "fail";
      else if (test.key === "pipeline") result = diagnostics ? (diagnostics.errors.count === 0 ? "pass" : "fail") : "pass";
      setTestResults((prev) => ({ ...prev, [test.key]: result }));
    }
    setIsRunningTests(false);
  }, [apiKey, sourceCount, connectedCount, project, diagnostics]);

  if (!projectId) return null;

  return (
    <div className="px-10 py-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <Beaker className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
                Intelligence Pipeline
              </h1>
              <p className="text-muted-foreground text-[14px] mt-0.5">
                {project?.name || "Loading..."} — Multi-Agent AI Extraction Engine
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/projects/${projectId}/controls`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[12px] font-medium text-primary hover:bg-primary/15 hover:border-primary/30 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Control Center
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-[12px]">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{sourceCount} sources</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-[12px]">
              <PlugZap className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{connectedCount} integrations</span>
            </div>
            {completedRuns.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-[12px]">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{completedRuns.length} runs</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Integration Sources Banner */}
      {connectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.03] px-5 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Puzzle className="w-4 h-4 text-primary" />
            <div>
              <span className="text-[13px] font-medium">
                {connectedCount} integration{connectedCount > 1 ? "s" : ""} connected
              </span>
              {integrationSources.length > 0 && (
                <span className="text-[12px] text-muted-foreground ml-2">
                  · {integrationSources.length} synced source{integrationSources.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncIntegrations}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
            >
              {isSyncing ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Sync Now</>
              )}
            </button>
            <button
              onClick={() => navigate("/integrations")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              <Settings2 className="w-3.5 h-3.5" /> Manage
            </button>
          </div>
        </motion.div>
      )}

      {/* Pipeline Progress */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-8 bg-gradient-to-br from-card via-card to-muted/10 rounded-2xl border border-border/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {latestRun?.status === "completed" ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              ) : latestRun?.status === "failed" ? (
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
              ) : latestRun?.status === "cancelled" ? (
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <StopCircle className="w-4 h-4 text-amber-600" />
                </div>
              ) : isRunning ? (
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  latestRun?.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : latestRun?.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : latestRun?.status === "cancelled"
                    ? "bg-amber-100 text-amber-700"
                    : isRunning
                    ? "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {latestRun?.status ? latestRun.status.replace(/_/g, " ") : "Ready"}
              </span>
            </div>

            {/* Cancel button while running */}
            {isRunning && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] border border-red-200 text-red-600 hover:bg-red-50 transition-all ml-2"
              >
                <StopCircle className="w-3 h-3" /> Cancel
              </button>
            )}
          </div>

          {/* Results when completed */}
          {latestRun?.status === "completed" && (
            <div className="flex items-center gap-6">
              {([
                { label: "Sources", value: latestRun.sourcesProcessed, color: "#F59E0B" },
                { label: "Requirements", value: latestRun.requirementsFound, color: "#6366F1" },
                { label: "Stakeholders", value: latestRun.stakeholdersFound, color: "#10B981" },
                { label: "Decisions", value: latestRun.decisionsFound, color: "#8B5CF6" },
                { label: "Conflicts", value: latestRun.conflictsFound, color: "#EF4444" },
              ] as const).map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-[18px] font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error message */}
          {latestRun?.status === "failed" && latestRun.error && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[11px] max-w-[400px] truncate">
              <XCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{latestRun.error}</span>
            </div>
          )}
        </div>

        {/* Pipeline Stages */}
        <div className="flex items-center gap-0.5">
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone = currentStageIndex > i || latestRun?.status === "completed";
            const isCurrent = currentStageIndex === i && latestRun?.status !== "completed" && latestRun?.status !== "failed" && latestRun?.status !== "cancelled";
            const isFailed = latestRun?.status === "failed" && currentStageIndex === i;
            const AgentIcon = AGENT_ICONS[stage.agent] || Cpu;
            const agentColor = AGENT_COLORS[stage.agent] || "#64748B";

            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : isFailed
                        ? "bg-red-100 text-red-600"
                        : isCurrent
                        ? "ring-2 ring-offset-2"
                        : "bg-muted/50 text-muted-foreground/40"
                    }`}
                    style={
                      isCurrent
                        ? { outlineColor: agentColor, backgroundColor: `${agentColor}15`, color: agentColor } as React.CSSProperties
                        : {}
                    }
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isFailed ? (
                      <XCircle className="w-5 h-5" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <AgentIcon className="w-4 h-4" />
                    )}

                    {isCurrent && (
                      <span className="absolute inset-0 rounded-xl animate-ping opacity-20" style={{ backgroundColor: agentColor }} />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-2 text-center font-medium ${
                      isDone || isCurrent ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className={`w-full h-0.5 mx-1 ${isDone ? "bg-emerald-300" : isFailed ? "bg-red-200" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Terminal / Log View */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0F1117] rounded-2xl border border-[#2A2D3A] overflow-hidden shadow-xl"
        >
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2D3A] bg-[#161920]">
            <div className="flex items-center gap-3">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-[13px] font-medium text-gray-200 font-mono">
                tracelayer-pipeline
              </span>
              <span className="text-[11px] text-gray-500 font-mono">— v2.1</span>
              {isRunning && (
                <span className="text-[10px] text-blue-400 font-mono animate-pulse">RUNNING</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${isRunning ? "bg-[#3B82F6] animate-pulse" : "bg-[#3B82F6]"}`} />
              <div className={`w-3 h-3 rounded-full ${latestRun?.status === "failed" ? "bg-[#EF4444]" : "bg-[#EAB308]"}`} />
              <div className={`w-3 h-3 rounded-full ${latestRun?.status === "completed" ? "bg-[#22C55E] animate-pulse" : "bg-[#22C55E]"}`} />
            </div>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="h-[480px] overflow-y-auto p-4 font-mono text-[12px] leading-[1.7] bg-[#0F1117]"
          >
            {!logs || logs.length === 0 ? (
              <div className="text-gray-400">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500">$</span>
                  <span className="text-gray-300">tracelayer pipeline --project &quot;{project?.name || "..."}&quot;</span>
                </div>
                <div className="mt-3 text-gray-500 text-[11px]">
                  <p className="mb-1">// Waiting for pipeline to start...</p>
                  <p className="mb-1">// Configure your AI provider and click &quot;Start Pipeline&quot;</p>
                  {connectedCount > 0 && (
                    <p className="mb-1 text-blue-400">// {connectedCount} integration(s) connected — data will auto-sync</p>
                  )}
                  {sourceCount > 0 && (
                    <p className="mb-1 text-emerald-400">// {sourceCount} source(s) ready for processing</p>
                  )}
                  <p>// Press Enter to continue</p>
                </div>
              </div>
            ) : (
              logs.map((log: any, i: number) => {
                const levelStyle = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
                const agentColor = AGENT_COLORS[log.agent] || "#64748B";
                const LevelIcon = levelStyle.icon;

                return (
                  <motion.div
                    key={log._id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.015 }}
                    className="flex items-start gap-2 mb-1 group"
                  >
                    <span className="text-[#4A5568] text-[10px] w-[55px] flex-shrink-0 mt-0.5 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className="text-[10px] w-[120px] flex-shrink-0 mt-0.5 font-medium font-mono"
                      style={{ color: agentColor }}
                    >
                      [{log.agent.replace(/_/g, " ")}]
                    </span>
                    <LevelIcon
                      className={`w-3 h-3 flex-shrink-0 mt-0.5 ${log.level === "processing" ? "animate-spin" : ""}`}
                      style={{ color: levelStyle.color }}
                    />
                    <span className="text-gray-300">{log.message}</span>
                  </motion.div>
                );
              })
            )}

            {isRunning && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[#22C55E]">$</span>
                <span className="w-2 h-4 bg-gray-300 animate-pulse" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          {/* AI Provider Config */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings2 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-[14px] font-semibold">AI Provider</h3>
            </div>

            <div className="space-y-2 mb-5">
              {([
                { id: "gemini", label: "Google Gemini", desc: "Free tier available", color: "#6366F1" },
                { id: "openai", label: "OpenAI GPT-4", desc: "GPT-4o model", color: "#10B981" },
                { id: "anthropic", label: "Anthropic Claude", desc: "Claude 3.5 Sonnet", color: "#F59E0B" },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id as "openai" | "gemini" | "anthropic")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] border transition-all duration-200 ${
                    provider === p.id
                      ? "border-2"
                      : "border-border/50 hover:border-muted-foreground/30"
                  }`}
                  style={
                    provider === p.id
                      ? { borderColor: p.color, backgroundColor: `${p.color}08` }
                      : {}
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: provider === p.id ? p.color : "inherit" }}>
                      {p.label}
                    </span>
                    {provider === p.id && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-[12px] font-medium text-muted-foreground mb-2 block">
                <KeyRound className="w-3.5 h-3.5 inline mr-1.5" />
                API Key
              </label>
              {usingStoredKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-[12px] text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="truncate">Using saved {provider} key</span>
                  </div>
                  <button
                    onClick={() => { setUsingStoredKey(false); setApiKey(""); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter ${provider} API key...`}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/50 bg-background/50 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {usingStoredKey
                  ? "Loaded from your saved keys in AI Settings"
                  : "Or save permanently in Settings > AI Settings"}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
              {/* Integration sync toggle */}
              {connectedCount > 0 && (
                <label className="flex items-center justify-between py-1.5 cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <PlugZap className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[12px]">Sync integrations first</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {connectedCount} apps
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSyncWithIntegrations(!syncWithIntegrations)}
                    className={`relative rounded-full transition-colors ${
                      syncWithIntegrations ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                    style={{ width: "2rem", height: "1.125rem" }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                        syncWithIntegrations ? "translate-x-3.5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
              )}

              {/* Regenerate toggle */}
              {latestRun?.status === "completed" && (
                <label className="flex items-center justify-between py-1.5 cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[12px]">Clear & regenerate</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegenerateMode(!regenerateMode)}
                    className={`relative rounded-full transition-colors ${
                      regenerateMode ? "bg-amber-500" : "bg-muted-foreground/30"
                    }`}
                    style={{ width: "2rem", height: "1.125rem" }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                        regenerateMode ? "translate-x-3.5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
              )}
            </div>

            {/* Start / Retry button */}
            <button
              onClick={handleStartPipeline}
              disabled={!apiKey || isRunning}
              className={`w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                !apiKey || isRunning
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
              }`}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : latestRun?.status === "failed" || latestRun?.status === "cancelled" ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Retry Pipeline
                </>
              ) : latestRun?.status === "completed" ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {regenerateMode ? "Regenerate" : "Re-run Pipeline"}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Pipeline
                </>
              )}
            </button>

            {/* Source info */}
            {sourceCount === 0 && connectedCount === 0 && (
              <p className="text-[10px] text-amber-600 mt-2 text-center">
                No sources or integrations. Upload data or connect apps first.
              </p>
            )}
          </div>

          {/* Quick Actions when completed */}
          {latestRun?.status === "completed" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-5"
            >
              <h3 className="text-[14px] font-semibold mb-4">View Results</h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/projects/${projectId}/brd`)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-between px-4"
                >
                  <span>Generated BRD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate(`/projects/${projectId}/graph`)}
                  className="w-full py-2.5 rounded-xl bg-background border border-border text-foreground text-[13px] font-medium hover:bg-muted/50 transition-colors flex items-center justify-between px-4"
                >
                  <span>Knowledge Graph</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate("/integrations")}
                  className="w-full py-2.5 rounded-xl bg-background border border-border text-foreground text-[13px] font-medium hover:bg-muted/50 transition-colors flex items-center justify-between px-4"
                >
                  <span>Integrations Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Run History */}
          {runHistory && runHistory.length > 1 && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-[13px] font-medium"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span>Run History</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {runHistory.length}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3 space-y-2"
                  >
                    {runHistory.map((run) => (
                      <div
                        key={run._id}
                        className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              run.status === "completed"
                                ? "bg-emerald-500"
                                : run.status === "failed"
                                ? "bg-red-500"
                                : run.status === "cancelled"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                          <span className="text-muted-foreground">
                            {run.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {run.status === "completed" && (
                            <span>{run.requirementsFound} reqs</span>
                          )}
                          <span>
                            {new Date(run.startedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ─── Pipeline Diagnostics ──────────────────────────── */}
          <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full flex items-center justify-between text-[13px] font-medium"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span>Pipeline Diagnostics</span>
                {diagnostics && diagnostics.errors.count > 0 && (
                  <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-medium">
                    {diagnostics.errors.count} error{diagnostics.errors.count > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDiagnostics ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showDiagnostics && diagnostics && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: "Total Runs", value: diagnostics.runs.total, color: "#6366F1" },
                      { label: "Success Rate", value: diagnostics.runs.total > 0 ? `${Math.round((diagnostics.runs.completed / diagnostics.runs.total) * 100)}%` : "—", color: "#10B981" },
                      { label: "Avg Duration", value: diagnostics.runs.avgDurationSec > 0 ? `${diagnostics.runs.avgDurationSec}s` : "—", color: "#F59E0B" },
                      { label: "Errors", value: diagnostics.errors.count, color: diagnostics.errors.count > 0 ? "#EF4444" : "#10B981" },
                    ] as const).map((m) => (
                      <div key={m.label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                        <p className="text-[18px] font-bold" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-[9px] text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {diagnostics.quality.avgConfidence > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Data Quality Confidence</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${diagnostics.quality.avgConfidence * 100}%`,
                            backgroundColor: diagnostics.quality.avgConfidence > 0.7 ? "#10B981" : diagnostics.quality.avgConfidence > 0.4 ? "#F59E0B" : "#EF4444",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        <span>{diagnostics.quality.highConfidence} high / {diagnostics.quality.lowConfidence} low</span>
                        <span>{Math.round(diagnostics.quality.avgConfidence * 100)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-muted-foreground">Sources</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-600 font-medium">{diagnostics.sources.extracted} extracted</span>
                      {diagnostics.sources.failed > 0 && (
                        <span className="text-red-500 font-medium">{diagnostics.sources.failed} failed</span>
                      )}
                    </div>
                  </div>

                  {diagnostics.errors.recentErrors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-red-500 font-medium">Recent Errors</p>
                      {diagnostics.errors.recentErrors.slice(0, 3).map((err: any, i: number) => (
                        <div key={i} className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-2.5 py-1.5 truncate">
                          {err.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extraction intelligence summary */}
                  {diagnostics.extraction && (
                    <div className="bg-muted/20 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-2 font-medium">Extraction Summary</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { label: "Requirements", value: diagnostics.extraction.requirements },
                          { label: "Stakeholders", value: diagnostics.extraction.stakeholders },
                          { label: "Decisions", value: diagnostics.extraction.decisions },
                          { label: "Timeline", value: diagnostics.extraction.timelineEvents },
                          { label: "Conflicts", value: diagnostics.extraction.conflicts },
                          { label: "Documents", value: diagnostics.extraction.documents },
                        ] as const).map((item) => (
                          <div key={item.label} className="text-center">
                            <p className="text-[14px] font-semibold text-foreground">{item.value}</p>
                            <p className="text-[8px] text-muted-foreground">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Integration Tests ──────────────────────────────── */}
          <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
            <button
              onClick={() => setShowTools(!showTools)}
              className="w-full flex items-center justify-between text-[13px] font-medium"
            >
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-muted-foreground" />
                <span>Integration Tests</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showTools ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showTools && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3 space-y-3"
                >
                  <button
                    onClick={handleRunTests}
                    disabled={isRunningTests}
                    className="w-full py-2.5 rounded-xl text-[12px] font-medium border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRunningTests ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running Tests...</>
                    ) : (
                      <><Beaker className="w-3.5 h-3.5" /> Run All Tests</>
                    )}
                  </button>
                  {testResults && (
                    <div className="space-y-1">
                      {([
                        { key: "apiKey", label: "API Key Configuration" },
                        { key: "sources", label: "Source Data Available" },
                        { key: "integrations", label: "Integration Connectivity" },
                        { key: "project", label: "Project State Valid" },
                        { key: "pipeline", label: "Pipeline Health" },
                      ] as const).map((test) => {
                        const status = testResults[test.key];
                        return (
                          <div key={test.key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-[11px] bg-muted/20">
                            <span className="text-muted-foreground">{test.label}</span>
                            {status === "running" ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : status === "pass" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : status === "fail" ? (
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : null}
                          </div>
                        );
                      })}
                      {!isRunningTests && Object.keys(testResults).length === 5 && (
                        <div className="text-center pt-2">
                          <span className={`text-[12px] font-semibold ${
                            Object.values(testResults).every((v) => v === "pass")
                              ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            {Object.values(testResults).filter((v) => v === "pass").length}/5 tests passed
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Danger Zone ──────────────────────────────────── */}
          <div className="bg-card rounded-2xl border border-red-200/30 p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-red-600 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Danger Zone
            </p>
            <div className="space-y-2">
              <button
                onClick={handleClearData}
                disabled={isClearing || isRunning}
                className="w-full py-2 rounded-xl text-[11px] font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isClearing ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Clearing...</>
                ) : (
                  <><Trash2 className="w-3 h-3" /> Clear All Extraction Data</>
                )}
              </button>
              <button
                onClick={handleClearHistory}
                disabled={isRunning}
                className="w-full py-2 rounded-xl text-[11px] font-medium border border-amber-200 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <History className="w-3 h-3" /> Clear Run History
              </button>
              <button
                onClick={() => refreshCounts({ projectId: projectId as Id<"projects"> })}
                className="w-full py-2 rounded-xl text-[11px] font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Project Counts
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
