/**
 * AIChat — The command center for TraceLayer.
 *
 * This is THE primary interface. Users interact with the AI which:
 * 1. Analyzes uploaded documents
 * 2. Triggers the extraction pipeline (agents)
 * 3. Shows inline pipeline progress with agent-by-agent status
 * 4. Generates and refines BRD/PRD documents
 * 5. Answers questions about extracted intelligence
 *
 * Architecture: Upload → Chat with AI → AI calls agents → BRD generated
 */
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  FileText,
  Zap,
  ChevronDown,
  AlertCircle,
  Play,
  Terminal,
  CheckCircle2,
  Cpu,
  Database,
  Users,
  GitBranch,
  Clock,
  Network,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

// ─── Pipeline agent stages for inline progress ──────────────────────────────
const PIPELINE_AGENTS = [
  { key: "ingestion", label: "Ingesting sources", icon: Database, color: "#E8A838" },
  { key: "classification", label: "Classifying content", icon: GitBranch, color: "#8B5CF6" },
  { key: "requirements", label: "Extracting requirements", icon: FileText, color: "#3B82F6" },
  { key: "stakeholders", label: "Identifying stakeholders", icon: Users, color: "#66BB8C" },
  { key: "decisions", label: "Extracting decisions", icon: Zap, color: "#F97316" },
  { key: "timeline", label: "Building timeline", icon: Clock, color: "#06B6D4" },
  { key: "conflicts", label: "Detecting conflicts", icon: AlertCircle, color: "#EF4444" },
  { key: "traceability", label: "Building traceability", icon: Network, color: "#EC4899" },
  { key: "document", label: "Generating BRD", icon: FileText, color: "#10B981" },
];

const QUICK_ACTIONS = [
  {
    icon: Play,
    label: "Analyze docs & generate BRD",
    prompt: "__RUN_PIPELINE__",
    primary: true,
    description: "Run all agents to extract intelligence and generate your BRD",
  },
  {
    icon: FileText,
    label: "Summarize my BRD",
    prompt: "Give me a brief overview of the current BRD status: how many requirements, stakeholders, conflicts were extracted, and what areas need attention. Don't output the full BRD — just the key insights.",
  },
  {
    icon: Zap,
    label: "Review requirements",
    prompt: "Review all extracted requirements. Are there any gaps, ambiguities, or missing non-functional requirements?",
  },
  {
    icon: Users,
    label: "Stakeholder analysis",
    prompt: "Provide a detailed stakeholder analysis with influence mapping, sentiment overview, and recommendations.",
  },
  {
    icon: AlertCircle,
    label: "Find conflicts",
    prompt: "Analyze all detected conflicts between requirements and suggest resolution strategies.",
  },
  {
    icon: MessageSquare,
    label: "What can you do?",
    prompt: "What are all the things you can help me with for this project? Explain your full capabilities.",
  },
];

interface AIChatProps {
  projectId: string;
}

export function AIChat({ projectId }: AIChatProps) {
  const navigate = useNavigate();
  const messages = useQuery(api.chat.listMessages, {
    projectId: projectId as Id<"projects">,
  });
  const storedKeyGemini = useQuery(api.apiKeys.getKeyForProvider, { provider: "gemini" });
  const storedKeyOpenai = useQuery(api.apiKeys.getKeyForProvider, { provider: "openai" });
  const storedKeyAnthropic = useQuery(api.apiKeys.getKeyForProvider, { provider: "anthropic" });
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);
  const chatAction = useAction(api.chatAction.chat);
  const runPipeline = useAction(api.extraction.runExtractionPipeline);
  const sendMessage = useMutation(api.chat.sendMessage);
  const project = useQuery(api.projects.get, { projectId: projectId as Id<"projects"> });
  const requirements = useQuery(api.requirements.listByProject, { projectId: projectId as Id<"projects"> });
  const stakeholders = useQuery(api.stakeholders.listByProject, { projectId: projectId as Id<"projects"> });
  const conflicts = useQuery(api.conflicts.listByProject, { projectId: projectId as Id<"projects"> });
  const decisions = useQuery(api.decisions.listByProject, { projectId: projectId as Id<"projects"> });
  const latestRun = useQuery(api.pipeline.getLatestRun, {
    projectId: projectId as Id<"projects">,
  });

  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic">("gemini");
  const [sending, setSending] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // API key resolution
  const getApiKey = useCallback(() => {
    if (provider === "gemini") return storedKeyGemini;
    if (provider === "openai") return storedKeyOpenai;
    if (provider === "anthropic") return storedKeyAnthropic;
    return null;
  }, [provider, storedKeyGemini, storedKeyOpenai, storedKeyAnthropic]);

  const currentKey = getApiKey();
  const hasKey = !!currentKey;

  // Auto-select provider with saved key
  useEffect(() => {
    if (!activeKeys) return;
    const providers = activeKeys.map((k: any) => k.provider);
    if (providers.includes("openai")) setProvider("openai");
    else if (providers.includes("gemini")) setProvider("gemini");
    else if (providers.includes("anthropic")) setProvider("anthropic");
  }, [activeKeys]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineRunning, pipelineStage, sending]);

  // Track pipeline progress via latestRun status
  useEffect(() => {
    if (!latestRun || !pipelineRunning) return;
    const statusMap: Record<string, number> = {
      ingesting: 0,
      classifying: 1,
      extracting_requirements: 2,
      extracting_stakeholders: 3,
      extracting_decisions: 4,
      extracting_timeline: 5,
      detecting_conflicts: 6,
      building_traceability: 7,
      generating_documents: 8,
      completed: 9,
    };
    const idx = statusMap[latestRun.status];
    if (idx !== undefined) setPipelineStage(idx);
  }, [latestRun?.status, pipelineRunning]);

  // Detect pipeline commands
  const isPipelineCommand = (msg: string) =>
    msg === "__RUN_PIPELINE__" ||
    /^(run|start|execute|launch|begin)\s+(the\s+)?(pipeline|extraction|agents?|analysis|intelligence)/i.test(msg) ||
    /^(generate|create|build)\s+(the\s+)?(brd|document)/i.test(msg) ||
    /^analy[sz]e\s+(my\s+|the\s+)?(docs?|documents?|sources?|files?|data)/i.test(msg);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending || pipelineRunning) return;

    if (!currentKey) {
      setError("No API key configured. Go to AI Settings to add one.");
      return;
    }

    // ─── Pipeline trigger ────────────────────────────────────────────────
    if (isPipelineCommand(msg)) {
      setInput("");
      setPipelineRunning(true);
      setPipelineStage(0);
      setError(null);

      try {
        await runPipeline({
          projectId: projectId as Id<"projects">,
          provider,
          apiKey: currentKey,
        });

        setPipelineStage(9); // completed

        // Post a system message with results + link to BRD
        const reqCount = requirements?.length ?? 0;
        const stkCount = stakeholders?.length ?? 0;
        const decCount = decisions?.length ?? 0;
        const confCount = conflicts?.length ?? 0;
        await sendMessage({
          projectId: projectId as Id<"projects">,
          role: "assistant",
          content: `__PIPELINE_COMPLETE__|${reqCount}|${stkCount}|${decCount}|${confCount}`,
          metadata: { action: "pipeline_complete" },
        });
      } catch (e: any) {
        setError(e.message || "Pipeline failed — check your API key and try again");
      } finally {
        setPipelineRunning(false);
        setPipelineStage(-1);
        inputRef.current?.focus();
      }
      return;
    }

    // ─── Normal chat message ─────────────────────────────────────────────
    setInput("");
    setSending(true);
    setError(null);

    try {
      await chatAction({
        projectId: projectId as Id<"projects">,
        userMessage: msg,
        provider,
        apiKey: currentKey,
      });
    } catch (e: any) {
      setError(e.message || "Failed to send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const providerInfo: Record<string, { label: string; color: string }> = {
    gemini: { label: "Gemini 2.0 Flash", color: "#4285F4" },
    openai: { label: "GPT-4o", color: "#10A37F" },
    anthropic: { label: "Claude", color: "#D97706" },
  };

  const msgList = messages ?? [];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium">TraceLayer AI</h3>
            <p className="text-[11px] text-muted-foreground">
              {project?.name ? `Working on: ${project.name}` : "Project intelligence assistant"}
            </p>
          </div>
        </div>

        {/* Provider picker */}
        <div className="relative">
          <button
            onClick={() => setShowProviderPicker(!showProviderPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] hover:bg-accent transition-colors"
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: providerInfo[provider].color }} />
            {providerInfo[provider].label}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          <AnimatePresence>
            {showProviderPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1"
              >
                {(["gemini", "openai", "anthropic"] as const).map((p) => {
                  const info = providerInfo[p];
                  const saved = activeKeys?.find((k: any) => k.provider === p);
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setProvider(p);
                        setShowProviderPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] hover:bg-accent transition-colors flex items-center justify-between ${
                        provider === p ? "bg-primary/5 text-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                        {info.label}
                      </div>
                      {saved && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          saved
                        </span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Messages Area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Empty state — show when no messages */}
        {msgList.length === 0 && !sending && !pipelineRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-[18px] font-medium mb-2">What would you like to do?</h3>
            <p className="text-[13px] text-muted-foreground mb-8 max-w-md">
              Upload your documents on the right, then tell me to analyze them.
              I'll run the extraction agents, pull out requirements, stakeholders, decisions,
              and generate a complete BRD for you.
            </p>

            {!hasKey && (
              <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-xl px-5 py-3 text-[12px] mb-6 max-w-md">
                <p className="font-medium">No API key configured</p>
                <p className="mt-0.5">
                  Go to{" "}
                  <button
                    onClick={() => navigate("/ai-settings")}
                    className="underline font-medium"
                  >
                    AI Settings
                  </button>{" "}
                  to add your {providerInfo[provider].label} key.
                </p>
              </div>
            )}

            {/* Quick actions grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-lg">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  disabled={!hasKey}
                  className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                    action.primary
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 col-span-3"
                      : "border-border hover:border-primary/30 hover:bg-accent"
                  }`}
                >
                  {action.primary ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <action.icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[13px] font-medium text-primary">{action.label}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-primary/60" />
                    </div>
                  ) : (
                    <>
                      <action.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground leading-tight">{action.label}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {msgList.map((msg: any) => {
          // ─── Pipeline completion card ────────────────────────────────────
          if (msg.content?.startsWith("__PIPELINE_COMPLETE__")) {
            const parts = msg.content.split("|");
            const reqCount = parts[1] || "0";
            const stkCount = parts[2] || "0";
            const decCount = parts[3] || "0";
            const confCount = parts[4] || "0";
            return (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="bg-card border border-emerald-200 rounded-2xl px-5 py-4 w-full max-w-[85%]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-[14px] font-medium text-emerald-700">Pipeline Complete — BRD Generated</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Requirements", value: reqCount, color: "text-blue-600" },
                      { label: "Stakeholders", value: stkCount, color: "text-purple-600" },
                      { label: "Decisions", value: decCount, color: "text-amber-600" },
                      { label: "Conflicts", value: confCount, color: "text-red-600" },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center bg-background rounded-lg py-2">
                        <p className={`text-[18px] font-semibold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/projects/${projectId}/brd`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-medium hover:bg-primary/90 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View BRD Document
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => navigate(`/projects/${projectId}/graph`)}
                      className="flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-xl text-[12px] text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Network className="w-3.5 h-3.5" />
                      Graph
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    You can now ask me to review requirements, analyze stakeholders, find gaps, or refine specific BRD sections.
                  </p>
                </div>
              </motion.div>
            );
          }

          // ─── Normal messages ─────────────────────────────────────────────
          return (
          <motion.div
            key={msg._id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {msg.role === "assistant" ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&_li]:mb-0.5"
                  dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }}
                />
              ) : (
                msg.content
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
          );
        })}

        {/* Thinking indicator */}
        {sending && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-5 py-3 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-[13px] text-muted-foreground">Thinking...</span>
            </div>
          </motion.div>
        )}

        {/* ─── Inline Pipeline Progress ───────────────────────────────────── */}
        {pipelineRunning && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-5 py-4 w-full max-w-[85%]">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-blue-600" />
                <span className="text-[13px] font-medium">Running Intelligence Pipeline</span>
              </div>

              {/* Agent progress list */}
              <div className="space-y-1.5">
                {PIPELINE_AGENTS.map((agent, i) => {
                  const isDone = pipelineStage > i;
                  const isCurrent = pipelineStage === i;
                  const isPending = pipelineStage < i;

                  return (
                    <div
                      key={agent.key}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all ${
                        isCurrent
                          ? "bg-blue-50 border border-blue-200"
                          : isDone
                          ? "bg-emerald-50/50"
                          : "opacity-40"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                      ) : (
                        <agent.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`text-[12px] ${
                          isCurrent
                            ? "text-blue-700 font-medium"
                            : isDone
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }`}
                      >
                        {agent.label}
                      </span>
                      {isDone && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground mt-3">
                This usually takes 1-2 minutes depending on document size...
              </p>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-[12px] max-w-[75%]"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">Error</span>
            </div>
            <p>{error}</p>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input Area ───────────────────────────────────────────────────── */}
      <div className="px-6 pb-4 pt-3 border-t border-border bg-card shrink-0">
        {/* Quick re-action bar when messages exist */}
        {msgList.length > 0 && !sending && !pipelineRunning && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
            {QUICK_ACTIONS.filter((a) => !a.primary).slice(0, 4).map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                disabled={!hasKey}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
              >
                <action.icon className="w-3 h-3" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasKey
                ? `No ${provider} API key — configure in AI Settings`
                : pipelineRunning
                ? "Pipeline is running..."
                : "Tell me what to do — analyze docs, generate BRD, review requirements..."
            }
            disabled={!hasKey || sending || pipelineRunning}
            rows={1}
            className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 max-h-[140px]"
            style={{ minHeight: "44px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "44px";
              target.style.height = Math.min(target.scrollHeight, 140) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || !hasKey || sending || pipelineRunning}
            className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Simple markdown → HTML ──────────────────────────────────────────────────
function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /```[\s\S]*?```/g,
      (m) =>
        `<pre class="bg-muted rounded-lg p-3 text-[12px] my-2 overflow-x-auto"><code>${m
          .slice(3, -3)
          .trim()}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[12px]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[16px] font-bold mt-3 mb-1">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
}
