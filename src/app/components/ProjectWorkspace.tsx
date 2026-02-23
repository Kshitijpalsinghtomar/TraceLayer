/**
 * ProjectWorkspace — Unified BRD Workspace
 *
 * Architecture: One-screen workspace where users upload resources,
 * select integration sources, generate the BRD, view/edit it, and chat with it.
 *
 * Flow: Upload resources → Select integration app → Generate BRD → View & Chat
 */
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileText,
  Mail,
  MessageSquare,
  Mic,
  File,
  CheckCircle2,
  Loader2,
  XCircle,
  GitBranch,
  Sparkles,
  MessageCircle,
  FolderOpen,
  Settings2,
  ArrowRight,
  Eye,
  BarChart3,
  LayoutGrid,
  Kanban,
  Database,
  Figma,
  Video,
  Cloud,
  Network,
  Cpu,
  Users,
  Zap,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  Target,
} from "lucide-react";
import { AIChat } from "./AIChat";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const SOURCE_TYPE_ICONS: Record<string, typeof FileText> = {
  email: Mail,
  meeting_transcript: Mic,
  chat_log: MessageSquare,
  document: FileText,
  uploaded_file: File,
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  email: "#E8A838",
  meeting_transcript: "#8B5CF6",
  chat_log: "#66BB8C",
  document: "#3B82F6",
  uploaded_file: "#64748B",
};

// ─── Integration Brand Icon + Color Mapping ────────────────────────────────
const INTEGRATION_META: Record<string, { icon: typeof MessageSquare; color: string; label: string }> = {
  slack: { icon: MessageSquare, color: "#4A154B", label: "Slack" },
  discord: { icon: MessageCircle, color: "#5865F2", label: "Discord" },
  ms_teams: { icon: MessageSquare, color: "#6264A7", label: "Teams" },
  github: { icon: GitBranch, color: "#8B949E", label: "GitHub" },
  gitlab: { icon: GitBranch, color: "#FC6D26", label: "GitLab" },
  bitbucket: { icon: GitBranch, color: "#0052CC", label: "Bitbucket" },
  jira: { icon: Kanban, color: "#0052CC", label: "Jira" },
  linear: { icon: ArrowRight, color: "#5E6AD2", label: "Linear" },
  asana: { icon: CheckCircle2, color: "#F06A6A", label: "Asana" },
  trello: { icon: LayoutGrid, color: "#0079BF", label: "Trello" },
  monday: { icon: LayoutGrid, color: "#FF3D57", label: "Monday" },
  notion: { icon: FileText, color: "#9B9B9B", label: "Notion" },
  confluence: { icon: Database, color: "#1868DB", label: "Confluence" },
  google_docs: { icon: FileText, color: "#4285F4", label: "Google Docs" },
  figma: { icon: Figma, color: "#F24E1E", label: "Figma" },
  gmail: { icon: Mail, color: "#EA4335", label: "Gmail" },
  outlook: { icon: Mail, color: "#0078D4", label: "Outlook" },
  google_meet: { icon: Video, color: "#00897B", label: "Google Meet" },
  zoom: { icon: Video, color: "#2D8CFF", label: "Zoom" },
  google_drive: { icon: Cloud, color: "#4285F4", label: "Google Drive" },
  dropbox: { icon: Cloud, color: "#0061FF", label: "Dropbox" },
  onedrive: { icon: Cloud, color: "#0078D4", label: "OneDrive" },
};

const ALLOWED_EXTENSIONS = [
  ".txt", ".md", ".csv", ".tsv", ".json", ".eml", ".xml", ".html", ".log", ".yml", ".yaml",
  ".vtt", ".srt", ".rtf", ".pdf", ".docx"
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONTENT_LENGTH = 500_000;

function isSupportedFile(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
}

async function extractTextFromFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    return fullText;
  }

  if (lower.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // Default for text files
  return await file.text();
}

function truncateContent(text: string): string {
  return text.length > MAX_CONTENT_LENGTH
    ? text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[... truncated at 500K chars ...]"
    : text;
}

type WorkspaceTab = "resources" | "brd" | "chat";

// ─── Pipeline Stage Config ─────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "ingesting", label: "Ingesting", icon: Database, color: "#F59E0B" },
  { key: "classifying", label: "Classifying", icon: GitBranch, color: "#8B5CF6" },
  { key: "extracting_requirements", label: "Requirements", icon: FileText, color: "#3B82F6" },
  { key: "extracting_stakeholders", label: "Stakeholders", icon: Users, color: "#10B981" },
  { key: "extracting_decisions", label: "Decisions", icon: Zap, color: "#F97316" },
  { key: "extracting_timeline", label: "Timeline", icon: Clock, color: "#06B6D4" },
  { key: "detecting_conflicts", label: "Conflicts", icon: AlertTriangle, color: "#EF4444" },
  { key: "building_traceability", label: "Traceability", icon: Network, color: "#EC4899" },
  { key: "generating_documents", label: "Generating BRD", icon: FileText, color: "#22C55E" },
];

/** Live pipeline progress banner — shown in workspace when pipeline is active */
function LivePipelineBanner({ projectId }: { projectId: string }) {
  const pid = projectId as Id<"projects">;
  const latestRun = useQuery(api.pipeline.getLatestRun, { projectId: pid });
  const logs = useQuery(
    api.pipeline.getLogsForRun,
    latestRun ? { extractionRunId: latestRun._id } : "skip"
  );
  const navigate = useNavigate();

  const isRunning = latestRun && !["completed", "failed", "cancelled"].includes(latestRun.status);
  const justCompleted = latestRun?.status === "completed" && latestRun.completedAt && (Date.now() - latestRun.completedAt < 30000);

  if (!isRunning && !justCompleted) return null;

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === latestRun?.status);
  const progressPercent = latestRun?.status === "completed"
    ? 100
    : currentStageIndex >= 0
      ? Math.round(((currentStageIndex + 0.5) / PIPELINE_STAGES.length) * 100)
      : 5;

  // Get latest log message
  const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`border-b ${latestRun?.status === "completed"
        ? "border-emerald-300 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-emerald-50/60 dark:from-emerald-950/40 dark:to-emerald-950/20"
        : "border-primary/25 bg-gradient-to-r from-primary/[0.06] via-violet-500/[0.04] to-primary/[0.06] dark:from-primary/[0.10] dark:via-violet-500/[0.06] dark:to-primary/[0.10]"}`}
    >
      <div className="px-6 py-3">
        {/* Top row: status + stages mini view */}
        <div className="flex items-center gap-4 mb-2.5">
          <div className="flex items-center gap-2 shrink-0">
            {latestRun?.status === "completed" ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/12 dark:bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
            )}
            <span className="text-[13px] font-semibold tracking-tight">
              {latestRun?.status === "completed" ? "Pipeline Complete" : "AI Pipeline Running"}
            </span>
          </div>

          {/* Mini stage indicators */}
          <div className="flex items-center gap-0.5 flex-1 bg-background/60 dark:bg-background/30 rounded-xl px-3 py-2 border border-border/50">
            {PIPELINE_STAGES.map((stage, i) => {
              const isDone = currentStageIndex > i || latestRun?.status === "completed";
              const isCurrent = currentStageIndex === i && isRunning;
              const StageIcon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 relative ${isDone
                        ? "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                        : isCurrent
                          ? "ring-1 ring-offset-1 ring-offset-transparent shadow-sm"
                          : "bg-muted/60 text-muted-foreground/40"
                        }`}
                      style={isCurrent ? { backgroundColor: `${stage.color}20`, color: stage.color, outlineColor: stage.color } : {}}
                      title={stage.label}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <StageIcon className="w-3 h-3" />
                      )}
                      {isCurrent && (
                        <span className="absolute inset-0 rounded-lg animate-ping opacity-20" style={{ backgroundColor: stage.color }} />
                      )}
                    </div>
                    <span className={`text-[7.5px] mt-0.5 text-center leading-tight font-medium ${isDone ? "text-emerald-600/70 dark:text-emerald-400/70" : isCurrent ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                      {stage.label}
                    </span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={`w-full h-[2px] mx-0.5 mt-[-8px] rounded-full ${isDone ? "bg-emerald-400/50 dark:bg-emerald-600/50" : "bg-border/40"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <span
            className="text-[11px] font-medium text-primary flex items-center gap-1.5 shrink-0 bg-primary/8 dark:bg-primary/15 px-3 py-1.5 rounded-lg select-none"
          >
            <Activity className="w-3 h-3" />
            Live
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-background/80 dark:bg-background/40 rounded-full overflow-hidden border border-border/30">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${latestRun?.status === "completed" ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-primary to-violet-500"}`}
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {isRunning && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse" />
          )}
        </div>

        {/* Latest agent log message */}
        {latestLog && (
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="font-mono text-[10px] font-semibold text-primary/70 bg-primary/8 dark:bg-primary/15 px-1.5 py-0.5 rounded">{(latestLog as any).agent?.replace(/_/g, " ")}</span>
            <span className="truncate text-muted-foreground/80">{(latestLog as any).message}</span>
          </div>
        )}

        {/* Completion stats */}
        {latestRun?.status === "completed" && (
          <div className="mt-2.5 flex items-center gap-4 text-[11px]">
            {[
              { label: "Sources", value: latestRun.sourcesProcessed, color: "#F59E0B" },
              { label: "Requirements", value: latestRun.requirementsFound, color: "#6366F1" },
              { label: "Stakeholders", value: latestRun.stakeholdersFound, color: "#10B981" },
              { label: "Conflicts", value: latestRun.conflictsFound, color: "#EF4444" },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 bg-background/70 dark:bg-background/30 border border-border/40 px-2.5 py-1 rounded-md">
                <span className="font-bold text-[12px]" style={{ color: s.color }}>{s.value}</span>
                <span className="text-muted-foreground/70 font-medium">{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const sources = useQuery(
    api.sources.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const allDocs = useQuery(
    api.documents.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const integrations = useQuery(api.integrations.list, {});
  const uploadSource = useMutation(api.sources.upload);
  const updateProject = useMutation(api.projects.update);
  const runPipeline = useAction(api.extraction.runExtractionPipeline);
  const storedKeyGemini = useQuery(api.apiKeys.getKeyForProvider, { provider: "gemini" });
  const storedKeyOpenai = useQuery(api.apiKeys.getKeyForProvider, { provider: "openai" });
  const storedKeyAnthropic = useQuery(api.apiKeys.getKeyForProvider, { provider: "anthropic" });
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: WorkspaceTab[] = ["resources", "brd", "chat"];
  const tabParam = searchParams.get("tab") as WorkspaceTab | null;
  const activeTab: WorkspaceTab = tabParam && validTabs.includes(tabParam) ? tabParam : "resources";
  const setActiveTab = useCallback(
    (tab: WorkspaceTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams]
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [disabledIntegrations, setDisabledIntegrations] = useState<Set<string>>(new Set());
  const [generatingBRD, setGeneratingBRD] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [brdFocus, setBrdFocus] = useState(project?.brdFocus || "");

  // Resolve API key for direct pipeline trigger
  const resolvedApiKey = storedKeyOpenai || storedKeyGemini || storedKeyAnthropic;
  const resolvedProvider: "openai" | "gemini" | "anthropic" = storedKeyOpenai ? "openai" : storedKeyGemini ? "gemini" : "anthropic";
  const hasApiKey = !!resolvedApiKey;

  const handleGenerateBRD = () => {
    if (!resolvedApiKey || generatingBRD) return;
    setShowFocusDialog(true);
  };

  const launchPipeline = async (focus: string) => {
    if (!resolvedApiKey || generatingBRD) return;
    setShowFocusDialog(false);
    setGeneratingBRD(true);
    setGenerateError(null);
    try {
      // Save focus to project
      if (focus.trim()) {
        await updateProject({
          projectId: projectId as Id<"projects">,
          brdFocus: focus.trim(),
        });
      } else {
        await updateProject({
          projectId: projectId as Id<"projects">,
          brdFocus: "",
        });
      }
      await runPipeline({
        projectId: projectId as Id<"projects">,
        provider: resolvedProvider,
        apiKey: resolvedApiKey,
      });
      setActiveTab("brd");
    } catch (e: any) {
      setGenerateError(e.message || "Pipeline failed — check your API key in Settings");
    } finally {
      setGeneratingBRD(false);
    }
  };

  // Check if BRD exists
  const brdDoc = useMemo(() => {
    if (!allDocs) return null;
    const brds = allDocs.filter((d: any) => d.type === "brd").sort((a: any, b: any) => b.version - a.version);
    return brds[0] || null;
  }, [allDocs]);

  const connectedIntegrations = useMemo(() => {
    if (!integrations) return [];
    return integrations.filter((i: any) => i.status === "connected" || i.status === "active");
  }, [integrations]);

  if (!projectId) return null;

  if (project === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-60px)] gap-3">
        <XCircle className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Project not found</p>
        <button onClick={() => navigate("/projects")} className="text-sm text-primary hover:underline">
          Back to Projects
        </button>
      </div>
    );
  }

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    setUploadStatus(null);
    let successCount = 0;
    const errorMessages: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        errorMessages.push(`${file.name}: Too large (max 10MB)`);
        continue;
      }
      if (!isSupportedFile(file.name)) {
        errorMessages.push(`${file.name}: Unsupported file type`);
        continue;
      }

      try {
        const rawText = await extractTextFromFile(file);
        const text = truncateContent(rawText);
        const lower = file.name.toLowerCase();
        let type: "email" | "meeting_transcript" | "chat_log" | "document" | "uploaded_file" = "uploaded_file";
        if (lower.endsWith(".eml") || lower.includes("email")) type = "email";
        else if (lower.includes("transcript") || lower.includes("meeting") || lower.endsWith(".vtt") || lower.endsWith(".srt")) type = "meeting_transcript";
        else if (lower.includes("slack") || lower.includes("chat")) type = "chat_log";
        else if (lower.endsWith(".md") || lower.endsWith(".html") || lower.endsWith(".xml") || lower.endsWith(".pdf") || lower.endsWith(".docx")) type = "document";

        await uploadSource({
          projectId: projectId as Id<"projects">,
          name: file.name,
          type,
          content: text,
          metadata: { wordCount: text.split(/\s+/).filter(Boolean).length, date: new Date().toISOString() },
        });
        successCount++;
      } catch {
        errorMessages.push(`${file.name}: Upload failed`);
      }
    }

    setUploading(false);
    if (successCount > 0 && errorMessages.length === 0) {
      setUploadStatus({ type: "success", message: `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully` });
    } else if (errorMessages.length > 0) {
      setUploadStatus({ type: "error", message: errorMessages.join("; ") });
    }
    setTimeout(() => setUploadStatus(null), 6000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const sourceList = sources ?? [];

  const tabs = [
    { id: "resources" as WorkspaceTab, label: "Resources", icon: FolderOpen, count: sourceList.length },
    { id: "brd" as WorkspaceTab, label: "BRD", icon: FileText, count: brdDoc ? 1 : 0 },
    { id: "chat" as WorkspaceTab, label: "Chat with BRD", icon: MessageCircle, count: null },
  ];

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden">
      {/* ─── Main Workspace Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Project Header + Tabs */}
        <div className="border-b border-border bg-card">
          {/* Project info bar */}
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <h1 className="text-[16px] font-semibold truncate">{project.name}</h1>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${project.status === "active" || project.status === "completed"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                : project.status === "processing" || project.status === "generating"
                  ? "bg-blue-50 text-blue-700 border border-blue-200/50"
                  : "bg-muted text-muted-foreground"
                }`}
            >
              {project.status}
            </span>

            {/* Stats */}
            <div className="ml-auto flex items-center gap-4">
              {[
                { label: "Sources", value: project.sourceCount, color: "#3B82F6" },
                { label: "Requirements", value: project.requirementCount, color: "#8B5CF6" },
                { label: "Stakeholders", value: project.stakeholderCount, color: "#059669" },
                { label: "Conflicts", value: project.conflictCount, color: "#EF4444" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Pipeline Progress Banner */}
          <LivePipelineBanner projectId={projectId} />

          {/* Tab bar */}
          <div className="px-6 flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ─── Resources Tab ──────────────────────────────────────── */}
            {activeTab === "resources" && (
              <motion.div
                key="resources"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 max-w-4xl mx-auto"
              >
                {/* Upload Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all mb-6 ${isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-primary/2"
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept={ALLOWED_EXTENSIONS.join(",")}
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }
                    }}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-[14px] text-primary font-medium">Uploading files...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-3">
                        <Upload className={`w-7 h-7 ${isDragging ? "text-primary" : "text-primary/50"}`} />
                      </div>
                      <p className="text-[15px] font-medium mb-1">Drop files here or click to upload</p>
                      <p className="text-[12px] text-muted-foreground">
                        Supports PDF, DOCX, TXT, MD, CSV, JSON, EML, XML, HTML and more (max 10MB)
                      </p>
                    </>
                  )}
                </div>

                <AnimatePresence>
                  {uploadStatus && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mb-4 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2 ${uploadStatus.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                        }`}
                    >
                      {uploadStatus.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                      {uploadStatus.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Connected Integrations */}
                {connectedIntegrations.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-primary" />
                      Connected Integrations
                      <span className="text-[11px] font-normal text-muted-foreground ml-auto">Toggle to include/exclude from AI</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {connectedIntegrations.map((intg: any) => {
                        const meta = INTEGRATION_META[intg.appId] || { icon: Network, color: "#6B7AE8", label: intg.appId };
                        const IntgIcon = meta.icon;
                        const isEnabled = !disabledIntegrations.has(intg._id);
                        return (
                          <div
                            key={intg._id}
                            className={`bg-card rounded-xl border p-3 flex items-center gap-3 transition-all duration-200 ${isEnabled
                              ? "border-border/50 hover:border-primary/20"
                              : "border-border/30 opacity-50"
                              }`}
                          >
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${meta.color}15` }}
                            >
                              <IntgIcon className="w-4 h-4" style={{ color: meta.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-foreground truncate">{meta.label}</p>
                              <p className={`text-[10px] ${isEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                {isEnabled ? "Active for AI" : "Paused"}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setDisabledIntegrations((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(intg._id)) next.delete(intg._id);
                                  else next.add(intg._id);
                                  return next;
                                })
                              }
                              className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${isEnabled ? "bg-primary" : "bg-muted"
                                }`}
                              aria-label={`${isEnabled ? "Disable" : "Enable"} ${meta.label} for AI`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isEnabled ? "translate-x-4" : ""
                                  }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Source list */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      Uploaded Sources ({sourceList.length})
                    </h3>
                    {!connectedIntegrations.length && (
                      <button
                        onClick={() => navigate("/integrations")}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        Connect integrations <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {sourceList.length > 0 ? (
                    <div className="space-y-2">
                      {sourceList.map((source) => {
                        const Icon = SOURCE_TYPE_ICONS[source.type] || File;
                        const color = SOURCE_TYPE_COLORS[source.type] || "#64748B";
                        return (
                          <div
                            key={source._id}
                            className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 hover:border-border transition-colors"
                          >
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: color + "15" }}
                            >
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate">{source.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {source.metadata?.wordCount?.toLocaleString()} words • {source.type.replace(/_/g, " ")}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${source.status === "extracted"
                                ? "bg-emerald-50 text-emerald-700"
                                : source.status === "uploaded"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-muted text-muted-foreground"
                                }`}
                            >
                              {source.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.04] rounded-2xl border border-primary/10 p-8">
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                          <FolderOpen className="w-7 h-7 text-primary/60" />
                        </div>
                        <h3 className="text-[16px] font-semibold mb-1">No sources yet</h3>
                        <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                          Add files or connect integrations to generate your BRD. TraceLayer needs communication data to extract requirements.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {[
                          {
                            step: 1,
                            title: "Upload Files",
                            desc: "Drop PDFs, emails, meeting transcripts, or chat logs above",
                            icon: Upload,
                            color: "#3B82F6",
                            active: true,
                          },
                          {
                            step: 2,
                            title: "Connect Integrations",
                            desc: "Link Slack, Jira, GitHub, or other tools for automatic syncing",
                            icon: Settings2,
                            color: "#8B5CF6",
                            active: !connectedIntegrations.length,
                          },
                          {
                            step: 3,
                            title: "Generate BRD",
                            desc: "Our 9 AI agents will extract requirements and produce a full BRD",
                            icon: Sparkles,
                            color: "#22C55E",
                            active: false,
                          },
                        ].map((item) => (
                          <div
                            key={item.step}
                            className={`rounded-xl p-4 border transition-all ${item.active
                              ? "border-primary/20 bg-card shadow-sm"
                              : "border-border/30 bg-card/50 opacity-60"
                              }`}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                              style={{ backgroundColor: `${item.color}12` }}
                            >
                              <item.icon className="w-4 h-4" style={{ color: item.color }} />
                            </div>
                            <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">
                              Step {item.step}
                            </div>
                            <p className="text-[12px] font-medium mb-0.5">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                          </div>
                        ))}
                      </div>

                      {!connectedIntegrations.length && (
                        <div className="mt-4 text-center">
                          <button
                            onClick={() => navigate("/integrations")}
                            className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Settings2 className="w-3 h-3" />
                            Set up integrations
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Generate BRD CTA */}
                {sourceList.length > 0 && (
                  <div className="mt-6 bg-gradient-to-r from-primary/8 to-primary/15 rounded-2xl border border-primary/15 p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-foreground">
                          {generatingBRD ? "Generating BRD..." : "Ready to generate BRD"}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          {hasApiKey
                            ? `${sourceList.length} source${sourceList.length > 1 ? "s" : ""} uploaded. 9 AI agents will extract requirements, stakeholders, decisions, and generate your BRD.`
                            : "Configure an API key in AI Settings first."}
                          {hasApiKey && " Estimated time: ~2-4 minutes."}
                        </p>
                      </div>
                      <button
                        onClick={handleGenerateBRD}
                        disabled={!hasApiKey || generatingBRD}
                        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                      >
                        {generatingBRD ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Generate BRD from {sourceList.length} Source{sourceList.length > 1 ? "s" : ""}</>
                        )}
                      </button>
                    </div>
                    {generateError && (
                      <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-[12px] text-red-700 dark:text-red-300 flex items-center gap-2">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        {generateError}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── BRD Focus Dialog ──────────────────────────────────────── */}
                <AnimatePresence>
                  {showFocusDialog && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                      onClick={() => setShowFocusDialog(false)}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
                              <Target className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-[16px] font-semibold">What should this BRD focus on?</h3>
                              <p className="text-[12px] text-muted-foreground">
                                Tell the AI what topic to extract from your {sourceList.length} source{sourceList.length > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Focus Input */}
                        <div className="px-6 pb-4">
                          <textarea
                            value={brdFocus}
                            onChange={(e) => setBrdFocus(e.target.value)}
                            placeholder="e.g., Payment system migration, User onboarding redesign, API gateway architecture..."
                            rows={3}
                            autoFocus
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all resize-none"
                          />
                          <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">
                            💡 Your sources may contain discussions about multiple projects. Defining a focus ensures the AI only extracts requirements, stakeholders, and decisions relevant to this specific topic.
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex items-center gap-2">
                          <button
                            onClick={() => launchPipeline(brdFocus)}
                            disabled={!brdFocus.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                          >
                            <Target className="w-4 h-4" />
                            Generate Focused BRD
                          </button>
                          <button
                            onClick={() => launchPipeline("")}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-accent/50 transition-all"
                          >
                            <Sparkles className="w-4 h-4" />
                            Skip — Full-Scope BRD
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ─── BRD Tab (View / Navigate) ───────────────────────────── */}
            {activeTab === "brd" && (
              <motion.div
                key="brd"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 max-w-4xl mx-auto"
              >
                {brdDoc ? (
                  <div className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border/50 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-[16px] font-semibold">Business Requirements Document</h3>
                          <p className="text-[12px] text-muted-foreground">
                            Version {brdDoc.version} • Generated {new Date(brdDoc.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Generation info */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: "Requirements", value: brdDoc.generatedFrom?.requirementCount ?? 0, color: "#4338CA" },
                          { label: "Sources", value: brdDoc.generatedFrom?.sourceCount ?? 0, color: "#D97706" },
                          { label: "Stakeholders", value: brdDoc.generatedFrom?.stakeholderCount ?? 0, color: "#059669" },
                          { label: "Decisions", value: brdDoc.generatedFrom?.decisionCount ?? 0, color: "#DC2626" },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-muted/30 rounded-xl p-3 text-center">
                            <p className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/projects/${projectId}/brd`)}
                          className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Full BRD
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${projectId}/graph`)}
                          className="px-4 py-2.5 bg-card border border-border rounded-xl text-[13px] font-medium hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <GitBranch className="w-4 h-4 text-primary" />
                          Knowledge Graph
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${projectId}/analytics`)}
                          className="px-4 py-2.5 bg-card border border-border rounded-xl text-[13px] font-medium hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <BarChart3 className="w-4 h-4 text-primary" />
                          Analytics
                        </button>
                      </div>
                    </div>

                    {/* Integration & Source Summary */}
                    <div className="bg-card rounded-2xl border border-border/50 p-5">
                      <h4 className="text-[13px] font-semibold mb-3 text-muted-foreground">Sources used in this BRD</h4>
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {sourceList.map((source) => {
                          const Icon = SOURCE_TYPE_ICONS[source.type] || File;
                          const color = SOURCE_TYPE_COLORS[source.type] || "#64748B";
                          return (
                            <div key={source._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30">
                              <Icon className="w-3.5 h-3.5" style={{ color }} />
                              <span className="text-[12px] truncate flex-1">{source.name}</span>
                              <span className="text-[10px] text-muted-foreground">{source.type.replace(/_/g, " ")}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
                      <FileText className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-[18px] font-semibold mb-2">No BRD Generated Yet</h3>
                    <p className="text-[14px] text-muted-foreground mb-6 text-center max-w-md">
                      {sourceList.length > 0
                        ? `You have ${sourceList.length} source${sourceList.length > 1 ? "s" : ""} uploaded. Generate a BRD now or upload more resources.`
                        : "Upload your documents in the Resources tab, then generate a BRD."}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveTab("resources")}
                        className="px-4 py-2 border border-border rounded-lg text-[13px] hover:bg-accent transition-colors"
                      >
                        Upload Resources
                      </button>
                      {sourceList.length > 0 && hasApiKey ? (
                        <button
                          onClick={handleGenerateBRD}
                          disabled={generatingBRD}
                          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                          {generatingBRD ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                          ) : (
                            <><Sparkles className="w-4 h-4" /> Generate BRD</>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab("chat")}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat with AI
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Chat with BRD Tab ──────────────────────────────────── */}
            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 h-full"
              >
                <AIChat projectId={projectId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
