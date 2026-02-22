/**
 * PipelineControlCenter — Dynamic control hub for BRD generation pipeline
 * 
 * Handles: start, stop, cancel, re-run, regenerate, source management,
 * error recovery, integration sync, data inspection, and diagnostics.
 */
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  StopCircle,
  RotateCcw,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  KeyRound,
  Download,
  Upload,
  PlugZap,
  Database,
  FileText,
  Users,
  Zap,
  GitBranch,
  Terminal,
  ChevronDown,
  ChevronUp,
  Activity,
  Shield,
  Eye,
  Eraser,
  Clock,
  Gauge,
  HeartPulse,
  Sparkles,
  ArrowRight,
  Info,
  Ban,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PipelineControlCenterProps {
  projectId: string;
  compact?: boolean; // sidebar mode
}

type ControlTab = "controls" | "diagnostics" | "data" | "testing";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  ingesting: "Ingesting Sources",
  classifying: "Classifying Content",
  extracting_requirements: "Extracting Requirements",
  extracting_stakeholders: "Extracting Stakeholders",
  extracting_decisions: "Extracting Decisions",
  extracting_timeline: "Extracting Timeline",
  detecting_conflicts: "Detecting Conflicts",
  building_traceability: "Building Traceability",
  generating_documents: "Generating Documents",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function PipelineControlCenter({ projectId, compact }: PipelineControlCenterProps) {
  const pid = projectId as Id<"projects">;

  // ─── Queries ─────────────────────────────────────────────────────────────
  const project = useQuery(api.projects.get, { projectId: pid });
  const pipelineStatus = useQuery(api.pipeline.isPipelineRunning, { projectId: pid });
  const latestRun = useQuery(api.pipeline.getLatestRun, { projectId: pid });
  const runHistory = useQuery(api.pipeline.listRunsForProject, { projectId: pid });
  const diagnostics = useQuery(api.pipeline.getDiagnostics, { projectId: pid });
  const sources = useQuery(api.sources.listByProject, { projectId: pid });
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);
  const connectedIntegrations = useQuery(api.integrations.listConnected);
  const logs = useQuery(
    api.pipeline.getLogsForRun,
    latestRun ? { extractionRunId: latestRun._id } : "skip"
  );

  // ─── Mutations / Actions ────────────────────────────────────────────────
  const runPipeline = useAction(api.extraction.runExtractionPipeline);
  const syncAndRun = useAction(api.integrationSync.syncAndRunPipeline);
  const syncAll = useAction(api.integrationSync.syncAllToProject);
  const cancelPipeline = useMutation(api.pipeline.cancelPipeline);
  const clearData = useMutation(api.projects.clearExtractionData);
  const clearHistory = useMutation(api.pipeline.clearRunHistory);
  const deleteSource = useMutation(api.pipeline.deleteSource);
  const refreshCounts = useMutation(api.projects.refreshCounts);

  // ─── State ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<ControlTab>("controls");
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [usingStoredKey, setUsingStoredKey] = useState(false);
  const [regenerateMode, setRegenerateMode] = useState(false);
  const [syncWithIntegrations, setSyncWithIntegrations] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: "pass" | "fail" | "running" | "pending"; message: string }>>({});
  const [isTestRunning, setIsTestRunning] = useState(false);

  // Auto-load stored key
  const storedKey = useQuery(api.apiKeys.getKeyForProvider, { provider });
  useEffect(() => {
    if (storedKey) { setApiKey(storedKey); setUsingStoredKey(true); }
    else { setApiKey(""); setUsingStoredKey(false); }
  }, [provider, storedKey]);

  // Detect running state
  useEffect(() => {
    if (pipelineStatus?.isRunning) setIsRunning(true);
    else if (latestRun && ["completed", "failed", "cancelled"].includes(latestRun.status)) setIsRunning(false);
  }, [pipelineStatus, latestRun]);

  // Clear action result after 4s
  useEffect(() => {
    if (actionResult) {
      const t = setTimeout(() => setActionResult(null), 4000);
      return () => clearTimeout(t);
    }
  }, [actionResult]);

  const connectedCount = connectedIntegrations?.length ?? 0;
  const sourceCount = sources?.length ?? 0;

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!apiKey || !projectId) return;
    setIsRunning(true);
    setActionResult(null);
    try {
      if (syncWithIntegrations && connectedCount > 0) {
        await syncAndRun({ projectId: pid, provider, apiKey, regenerate: regenerateMode });
      } else {
        await runPipeline({ projectId: pid, provider, apiKey, regenerate: regenerateMode });
      }
      setActionResult({ type: "success", message: "Pipeline completed successfully!" });
    } catch (e: any) {
      setActionResult({ type: "error", message: e.message || "Pipeline failed" });
    } finally {
      setIsRunning(false);
    }
  }, [apiKey, projectId, provider, syncWithIntegrations, connectedCount, regenerateMode, syncAndRun, runPipeline, pid]);

  const handleCancel = useCallback(async () => {
    await cancelPipeline({ projectId: pid });
    setIsRunning(false);
    setActionResult({ type: "success", message: "Pipeline cancelled" });
    setConfirmAction(null);
  }, [pid, cancelPipeline]);

  const handleClearData = useCallback(async () => {
    await clearData({ projectId: pid });
    setActionResult({ type: "success", message: "All extracted data cleared" });
    setConfirmAction(null);
  }, [pid, clearData]);

  const handleClearHistory = useCallback(async () => {
    await clearHistory({ projectId: pid, keepLatest: 1 });
    setActionResult({ type: "success", message: "Run history cleared" });
    setConfirmAction(null);
  }, [pid, clearHistory]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncAll({ projectId: pid });
      setActionResult({ type: "success", message: "Integrations synced" });
    } catch (e: any) {
      setActionResult({ type: "error", message: `Sync failed: ${e.message}` });
    } finally {
      setIsSyncing(false);
    }
  }, [pid, syncAll]);

  const handleDeleteSource = useCallback(async (sourceId: Id<"sources">) => {
    await deleteSource({ sourceId });
    setActionResult({ type: "success", message: "Source deleted" });
  }, [deleteSource]);

  const handleRefreshCounts = useCallback(async () => {
    await refreshCounts({ projectId: pid });
    setActionResult({ type: "success", message: "Counts refreshed" });
  }, [pid, refreshCounts]);

  // ─── Integration & Pipeline Tests ─────────────────────────────────────
  const runIntegrationTests = useCallback(async () => {
    setIsTestRunning(true);
    const results: Record<string, { status: "pass" | "fail" | "running" | "pending"; message: string }> = {};

    // Test 1: API Key configured
    results["api_key"] = { status: "running", message: "Checking API key..." };
    setTestResults({ ...results });
    await sleep(400);
    if (apiKey && apiKey.length > 10) {
      results["api_key"] = { status: "pass", message: `${provider} key configured (${apiKey.slice(0, 6)}...)` };
    } else {
      results["api_key"] = { status: "fail", message: "No valid API key configured" };
    }
    setTestResults({ ...results });

    // Test 2: Sources available
    results["sources"] = { status: "running", message: "Checking sources..." };
    setTestResults({ ...results });
    await sleep(300);
    if (sourceCount > 0) {
      const totalWords = (sources || []).reduce((s, src) => s + (src.metadata?.wordCount || 0), 0);
      results["sources"] = { status: "pass", message: `${sourceCount} sources (${totalWords.toLocaleString()} words)` };
    } else {
      results["sources"] = { status: "fail", message: "No sources uploaded — upload files or connect integrations" };
    }
    setTestResults({ ...results });

    // Test 3: Integration health
    results["integrations"] = { status: "running", message: "Checking integrations..." };
    setTestResults({ ...results });
    await sleep(350);
    if (connectedCount > 0) {
      results["integrations"] = { status: "pass", message: `${connectedCount} integration(s) connected` };
    } else {
      results["integrations"] = { status: "pass", message: "No integrations connected (optional)" };
    }
    setTestResults({ ...results });

    // Test 4: Project state
    results["project_state"] = { status: "running", message: "Checking project..." };
    setTestResults({ ...results });
    await sleep(300);
    if (project) {
      const stateOk = !["processing", "generating"].includes(project.status) || isRunning;
      results["project_state"] = stateOk
        ? { status: "pass", message: `Project "${project.name}" ready (${project.status})` }
        : { status: "fail", message: `Project stuck in "${project.status}" — try clearing data` };
    } else {
      results["project_state"] = { status: "fail", message: "Project not found" };
    }
    setTestResults({ ...results });

    // Test 5: Data extraction quality
    results["data_quality"] = { status: "running", message: "Checking extraction quality..." };
    setTestResults({ ...results });
    await sleep(400);
    if (diagnostics && diagnostics.extraction.requirements > 0) {
      const conf = diagnostics.quality.avgConfidence;
      const label = conf >= 0.7 ? "Good" : conf >= 0.5 ? "Fair" : "Low";
      results["data_quality"] = {
        status: conf >= 0.5 ? "pass" : "fail",
        message: `${diagnostics.extraction.requirements} reqs, ${label} confidence (${(conf * 100).toFixed(0)}%)`,
      };
    } else {
      results["data_quality"] = { status: "pass", message: "No extraction data yet — run pipeline first" };
    }
    setTestResults({ ...results });

    // Test 6: Pipeline history
    results["pipeline_health"] = { status: "running", message: "Checking pipeline health..." };
    setTestResults({ ...results });
    await sleep(300);
    if (diagnostics) {
      const failRate = diagnostics.runs.total > 0 ? diagnostics.runs.failed / diagnostics.runs.total : 0;
      results["pipeline_health"] = failRate < 0.5
        ? { status: "pass", message: `${diagnostics.runs.completed}/${diagnostics.runs.total} runs succeeded` }
        : { status: "fail", message: `High failure rate: ${diagnostics.runs.failed}/${diagnostics.runs.total} failed` };
    } else {
      results["pipeline_health"] = { status: "pass", message: "No run history" };
    }
    setTestResults({ ...results });

    // Test 7: Document generation
    results["documents"] = { status: "running", message: "Checking generated documents..." };
    setTestResults({ ...results });
    await sleep(300);
    if (diagnostics && diagnostics.extraction.documents > 0) {
      results["documents"] = { status: "pass", message: `${diagnostics.extraction.documents} document(s) generated` };
    } else {
      results["documents"] = { status: "pass", message: "No documents generated yet" };
    }
    setTestResults({ ...results });

    // Test 8: Error state
    results["error_check"] = { status: "running", message: "Checking for errors..." };
    setTestResults({ ...results });
    await sleep(250);
    if (diagnostics && diagnostics.errors.count > 0) {
      results["error_check"] = {
        status: "fail",
        message: `${diagnostics.errors.count} error(s) in latest run`,
      };
    } else {
      results["error_check"] = { status: "pass", message: "No errors detected" };
    }
    setTestResults({ ...results });

    setIsTestRunning(false);
  }, [apiKey, provider, sourceCount, sources, connectedCount, project, diagnostics, isRunning]);

  // ─── Derived data ─────────────────────────────────────────────────────
  const isCompleted = latestRun?.status === "completed";
  const isFailed = latestRun?.status === "failed";
  const isCancelled = latestRun?.status === "cancelled";
  const isIdle = !isRunning && !latestRun;
  const canStart = !!apiKey && !isRunning;
  const hasData = (diagnostics?.extraction.requirements ?? 0) > 0;

  // Current pipeline stage name
  const currentStage = isRunning && latestRun
    ? STAGE_LABELS[latestRun.status] || latestRun.status.replace(/_/g, " ")
    : null;

  // Error logs from latest run
  const recentErrors = diagnostics?.errors.recentErrors || [];

  const tabs: { id: ControlTab; label: string; icon: typeof Play }[] = [
    { id: "controls", label: "Controls", icon: Settings2 },
    { id: "diagnostics", label: "Health", icon: HeartPulse },
    { id: "data", label: "Data", icon: Database },
    { id: "testing", label: "Tests", icon: Shield },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Tabs ── */}
      <div className="flex border-b border-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all border-b-2 ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Action Result Toast ── */}
      <AnimatePresence>
        {actionResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mx-3 mt-2 px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 ${
              actionResult.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {actionResult.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{actionResult.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CONTROLS TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tab === "controls" && (
            <motion.div
              key="controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-3"
            >
              {/* Pipeline Status Banner */}
              <div className={`rounded-xl p-3 border ${
                isRunning
                  ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                  : isCompleted
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : isFailed
                  ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : isCancelled
                  ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                  : "bg-muted/30 border-border"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isFailed ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : isCancelled ? (
                    <Ban className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-[12px] font-semibold">
                    {isRunning ? "Pipeline Running" : isCompleted ? "Pipeline Complete" : isFailed ? "Pipeline Failed" : isCancelled ? "Pipeline Cancelled" : "Ready to Run"}
                  </span>
                </div>
                {currentStage && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 ml-6 font-mono">
                    Stage: {currentStage}
                  </p>
                )}
                {isFailed && latestRun?.error && (
                  <p className="text-[10px] text-red-600 ml-6 mt-1 line-clamp-2">{latestRun.error}</p>
                )}
                {isCompleted && latestRun && (
                  <div className="flex items-center gap-3 ml-6 mt-1">
                    {[
                      { label: "Reqs", value: latestRun.requirementsFound, color: "#6366F1" },
                      { label: "Stkh", value: latestRun.stakeholdersFound, color: "#10B981" },
                      { label: "Dec", value: latestRun.decisionsFound, color: "#8B5CF6" },
                      { label: "Conf", value: latestRun.conflictsFound, color: "#EF4444" },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className="text-[13px] font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[8px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI Provider</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: "gemini", label: "Gemini", color: "#6366F1" },
                    { id: "openai", label: "GPT-4o", color: "#10B981" },
                    { id: "anthropic", label: "Claude", color: "#F59E0B" },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      disabled={isRunning}
                      className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                        provider === p.id
                          ? "border-2"
                          : "border-border/50 hover:border-muted-foreground/30"
                      } disabled:opacity-50`}
                      style={provider === p.id ? { borderColor: p.color, backgroundColor: `${p.color}08`, color: p.color } : {}}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* API Key */}
                {usingStoredKey ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 px-2.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700 flex items-center gap-1.5 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="truncate">Using saved {provider} key</span>
                    </div>
                    <button
                      onClick={() => { setUsingStoredKey(false); setApiKey(""); }}
                      className="text-[9px] text-muted-foreground hover:text-foreground px-2 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`${provider} API key...`}
                      disabled={isRunning}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-border/50 bg-background/50 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all disabled:opacity-50"
                    />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-1.5">
                {connectedCount > 0 && (
                  <ToggleOption
                    icon={PlugZap}
                    label="Sync integrations first"
                    badge={`${connectedCount} apps`}
                    checked={syncWithIntegrations}
                    onChange={setSyncWithIntegrations}
                    disabled={isRunning}
                  />
                )}
                {isCompleted && (
                  <ToggleOption
                    icon={RotateCcw}
                    label="Clear & regenerate"
                    checked={regenerateMode}
                    onChange={setRegenerateMode}
                    disabled={isRunning}
                    color="#F59E0B"
                  />
                )}
              </div>

              {/* Primary Action */}
              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`w-full py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all ${
                  !canStart
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                }`}
              >
                {isRunning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</>
                ) : isFailed || isCancelled ? (
                  <><RotateCcw className="w-3.5 h-3.5" />Retry Pipeline</>
                ) : isCompleted ? (
                  <><RefreshCw className="w-3.5 h-3.5" />{regenerateMode ? "Regenerate" : "Re-run"}</>
                ) : (
                  <><Play className="w-3.5 h-3.5" />Start Pipeline</>
                )}
              </button>

              {/* Secondary Actions */}
              {isRunning && (
                <button
                  onClick={() => setConfirmAction("cancel")}
                  className="w-full py-2 rounded-xl text-[11px] border border-red-200 text-red-600 hover:bg-red-50 transition flex items-center justify-center gap-1.5 dark:border-red-800 dark:hover:bg-red-950/30"
                >
                  <StopCircle className="w-3.5 h-3.5" /> Cancel Pipeline
                </button>
              )}

              {!isRunning && sourceCount === 0 && connectedCount === 0 && (
                <p className="text-[10px] text-amber-600 text-center flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  No sources or integrations — upload data first
                </p>
              )}

              {/* Integration Sync */}
              {connectedCount > 0 && !isRunning && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full py-2 rounded-lg text-[11px] border border-primary/30 text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {isSyncing ? "Syncing..." : "Sync Integrations Now"}
                </button>
              )}

              {/* Danger Zone */}
              {!isRunning && (hasData || (runHistory && runHistory.length > 0)) && (
                <CollapsibleSection
                  title="Danger Zone"
                  icon={AlertTriangle}
                  color="#EF4444"
                  expanded={expandedSection === "danger"}
                  onToggle={() => setExpandedSection(expandedSection === "danger" ? null : "danger")}
                >
                  <div className="space-y-1.5">
                    {hasData && (
                      <button
                        onClick={() => setConfirmAction("clear_data")}
                        className="w-full py-2 rounded-lg text-[10px] border border-red-200 text-red-600 hover:bg-red-50 transition flex items-center justify-center gap-1.5 dark:border-red-800 dark:hover:bg-red-950/30"
                      >
                        <Eraser className="w-3 h-3" /> Clear All Extracted Data
                      </button>
                    )}
                    {runHistory && runHistory.length > 1 && (
                      <button
                        onClick={() => setConfirmAction("clear_history")}
                        className="w-full py-2 rounded-lg text-[10px] border border-amber-200 text-amber-600 hover:bg-amber-50 transition flex items-center justify-center gap-1.5 dark:border-amber-800 dark:hover:bg-amber-950/30"
                      >
                        <Trash2 className="w-3 h-3" /> Clear Run History
                      </button>
                    )}
                    <button
                      onClick={handleRefreshCounts}
                      className="w-full py-2 rounded-lg text-[10px] border border-border text-muted-foreground hover:bg-muted/50 transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Project Counts
                    </button>
                  </div>
                </CollapsibleSection>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* DIAGNOSTICS TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tab === "diagnostics" && (
            <motion.div
              key="diagnostics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-3"
            >
              {diagnostics ? (
                <>
                  {/* Health Overview */}
                  <div className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <HeartPulse className="w-4 h-4 text-primary" />
                      <span className="text-[12px] font-semibold">Pipeline Health</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <MetricCard label="Total Runs" value={diagnostics.runs.total} icon={Activity} color="#3B82F6" />
                      <MetricCard label="Success Rate" value={diagnostics.runs.total > 0 ? `${Math.round((diagnostics.runs.completed / diagnostics.runs.total) * 100)}%` : "—"} icon={CheckCircle2} color="#10B981" />
                      <MetricCard label="Avg Duration" value={diagnostics.runs.avgDurationSec > 0 ? `${diagnostics.runs.avgDurationSec}s` : "—"} icon={Clock} color="#F59E0B" />
                      <MetricCard label="Errors" value={diagnostics.errors.count} icon={AlertTriangle} color={diagnostics.errors.count > 0 ? "#EF4444" : "#10B981"} />
                    </div>
                  </div>

                  {/* Data Quality */}
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Gauge className="w-4 h-4 text-primary" />
                      <span className="text-[12px] font-semibold">Data Quality</span>
                    </div>

                    {diagnostics.quality.total > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className={`font-semibold ${diagnostics.quality.avgConfidence >= 0.7 ? "text-emerald-600" : diagnostics.quality.avgConfidence >= 0.5 ? "text-amber-600" : "text-red-600"}`}>
                            {(diagnostics.quality.avgConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${diagnostics.quality.avgConfidence * 100}%`,
                              background: diagnostics.quality.avgConfidence >= 0.7 ? "#10B981" : diagnostics.quality.avgConfidence >= 0.5 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>{diagnostics.quality.highConfidence} high conf.</span>
                          <span>{diagnostics.quality.lowConfidence} low conf.</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No requirements extracted yet</p>
                    )}
                  </div>

                  {/* Source Health */}
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-[12px] font-semibold">Sources</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[14px] font-bold text-foreground">{diagnostics.sources.total}</p>
                        <p className="text-[8px] text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-emerald-600">{diagnostics.sources.extracted}</p>
                        <p className="text-[8px] text-muted-foreground">Extracted</p>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-red-600">{diagnostics.sources.failed}</p>
                        <p className="text-[8px] text-muted-foreground">Failed</p>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">
                      {diagnostics.sources.totalWords.toLocaleString()} total words
                    </p>
                  </div>

                  {/* Recent Errors */}
                  {recentErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-2 dark:bg-red-950/20 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-[12px] font-semibold text-red-700 dark:text-red-400">Recent Errors</span>
                      </div>
                      {recentErrors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px]">
                          <span className="text-red-400 font-mono shrink-0">[{err.agent.replace(/_/g, " ")}]</span>
                          <span className="text-red-700 dark:text-red-300 line-clamp-2">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extraction Summary */}
                  <div className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-[12px] font-semibold">Extracted Intelligence</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Requirements", value: diagnostics.extraction.requirements, icon: FileText, color: "#6366F1" },
                        { label: "Stakeholders", value: diagnostics.extraction.stakeholders, icon: Users, color: "#10B981" },
                        { label: "Decisions", value: diagnostics.extraction.decisions, icon: GitBranch, color: "#8B5CF6" },
                        { label: "Conflicts", value: diagnostics.extraction.conflicts, icon: AlertTriangle, color: "#EF4444" },
                        { label: "Documents", value: diagnostics.extraction.documents, icon: FileText, color: "#3B82F6" },
                        { label: "Sources", value: diagnostics.sources.total, icon: Database, color: "#F59E0B" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                          <item.icon className="w-3 h-3" style={{ color: item.color }} />
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                          </div>
                          <span className="text-[12px] font-bold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* DATA TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tab === "data" && (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-3"
            >
              {/* Sources Management */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sources ({sourceCount})
                  </p>
                  {sourceCount > 0 && (
                    <span className="text-[9px] text-muted-foreground">
                      {(sources || []).reduce((s, src) => s + (src.metadata?.wordCount || 0), 0).toLocaleString()} words
                    </span>
                  )}
                </div>

                {(sources || []).length > 0 ? (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {(sources || []).map((source) => (
                      <div
                        key={source._id}
                        className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border/40 group"
                      >
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: sourceColor(source.type) + "15" }}
                        >
                          <FileText className="w-3 h-3" style={{ color: sourceColor(source.type) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium truncate">{source.name}</p>
                          <p className="text-[8px] text-muted-foreground">
                            {source.type.replace(/_/g, " ")} · {source.metadata?.wordCount?.toLocaleString() || "?"} words
                          </p>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          source.status === "extracted"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : source.status === "failed"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {source.status}
                        </span>
                        <button
                          onClick={() => handleDeleteSource(source._id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-all dark:hover:bg-red-950/30"
                          title="Delete source"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground/50">
                    <Upload className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-[10px]">No sources uploaded yet</p>
                  </div>
                )}
              </div>

              {/* Run History */}
              {runHistory && runHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Run History ({runHistory.length})
                  </p>
                  <div className="space-y-1 max-h-[250px] overflow-y-auto">
                    {runHistory.map((run) => (
                      <div key={run._id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            run.status === "completed" ? "bg-emerald-500" :
                            run.status === "failed" ? "bg-red-500" :
                            run.status === "cancelled" ? "bg-amber-500" : "bg-blue-500 animate-pulse"
                          }`} />
                          <div>
                            <p className="text-[10px] font-medium capitalize">{run.status.replace(/_/g, " ")}</p>
                            <p className="text-[8px] text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                          {run.status === "completed" && (
                            <span>{run.requirementsFound}r · {run.stakeholdersFound}s · {run.decisionsFound}d</span>
                          )}
                          {run.completedAt && run.startedAt && (
                            <span className="text-[8px]">{Math.round((run.completedAt - run.startedAt) / 1000)}s</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TESTING TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {tab === "testing" && (
            <motion.div
              key="testing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-semibold">Integration Tests</span>
                </div>
                <button
                  onClick={runIntegrationTests}
                  disabled={isTestRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isTestRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {isTestRunning ? "Running..." : "Run Tests"}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Validate API keys, sources, integrations, data extraction quality, and pipeline health.
              </p>

              {Object.keys(testResults).length > 0 && (
                <div className="space-y-1.5">
                  {[
                    { key: "api_key", label: "API Key", icon: KeyRound },
                    { key: "sources", label: "Sources", icon: Database },
                    { key: "integrations", label: "Integrations", icon: PlugZap },
                    { key: "project_state", label: "Project State", icon: FileText },
                    { key: "data_quality", label: "Data Quality", icon: Gauge },
                    { key: "pipeline_health", label: "Pipeline Health", icon: HeartPulse },
                    { key: "documents", label: "Documents", icon: FileText },
                    { key: "error_check", label: "Error Check", icon: AlertTriangle },
                  ].map(({ key, label, icon: Icon }) => {
                    const result = testResults[key];
                    if (!result) return null;
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
                          result.status === "pass"
                            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                            : result.status === "fail"
                            ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        {result.status === "running" ? (
                          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                        ) : result.status === "pass" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : result.status === "fail" ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : (
                          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium">{label}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{result.message}</p>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Summary */}
                  {!isTestRunning && Object.keys(testResults).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      {(() => {
                        const passed = Object.values(testResults).filter((r) => r.status === "pass").length;
                        const failed = Object.values(testResults).filter((r) => r.status === "fail").length;
                        const total = Object.values(testResults).length;
                        return (
                          <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                            failed === 0
                              ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                              : "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                          }`}>
                            {failed === 0 ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            )}
                            <span className="text-[11px] font-medium">
                              {passed}/{total} checks passed
                              {failed > 0 && ` · ${failed} issue${failed > 1 ? "s" : ""}`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {Object.keys(testResults).length === 0 && (
                <div className="text-center py-8">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[10px] text-muted-foreground">Click "Run Tests" to validate your setup</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Confirm Dialog ── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card rounded-xl border border-border p-5 shadow-xl max-w-[260px] w-full"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-[13px] font-semibold">Confirm Action</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">
                {confirmAction === "cancel"
                  ? "This will stop the running pipeline. Any partial data will be preserved."
                  : confirmAction === "clear_data"
                  ? "This will delete ALL extracted requirements, stakeholders, decisions, conflicts, and documents. Sources will be kept."
                  : "This will delete all run history except the latest run."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 rounded-lg text-[11px] border border-border hover:bg-muted/50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={
                    confirmAction === "cancel" ? handleCancel
                    : confirmAction === "clear_data" ? handleClearData
                    : handleClearHistory
                  }
                  className="flex-1 py-2 rounded-lg text-[11px] bg-red-600 text-white hover:bg-red-700 transition font-medium"
                >
                  {confirmAction === "cancel" ? "Stop Pipeline" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ToggleOption({
  icon: Icon,
  label,
  badge,
  checked,
  onChange,
  disabled,
  color,
}: {
  icon: typeof Play;
  label: string;
  badge?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px]">{label}</span>
        {badge && (
          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{badge}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        className={`relative rounded-full transition-colors ${
          checked ? "" : "bg-muted-foreground/30"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{
          width: "2rem",
          height: "1.125rem",
          backgroundColor: checked ? (color || "var(--primary)") : undefined,
        }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof Play;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/40">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[13px] font-bold" style={{ color }}>{value}</p>
        <p className="text-[8px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  color,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Play;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2.5 text-[11px] font-medium hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span>{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function sourceColor(type: string): string {
  const colors: Record<string, string> = {
    email: "#E8A838",
    meeting_transcript: "#8B5CF6",
    chat_log: "#66BB8C",
    document: "#3B82F6",
    uploaded_file: "#64748B",
  };
  return colors[type] || "#64748B";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
