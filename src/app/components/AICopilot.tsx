/**
 * AICopilot — Global Floating AI Assistant
 *
 * Accessible from every page via a floating trigger button (bottom-right).
 * Opens a slide-out panel with full AI chat capabilities.
 *
 * Features:
 * - Context-aware: knows which page you're on, which project
 * - In-memory chat state (no database persistence for global chat)
 * - Keyboard shortcut: Ctrl+J to toggle
 * - Multi-provider support (Gemini/OpenAI/Anthropic)
 * - Quick actions for common tasks
 * - Animated transitions and professional UI
 *
 * This is SEPARATE from the project-specific AIChat component.
 * The Copilot works globally across the entire platform.
 */
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Loader2,
  User,
  Cpu,
  Layers,
  Keyboard,
  AlertCircle,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronDown,
  ArrowRight,
  Zap,
  FileText,
  Users,
  Network,
  BarChart3,
  HelpCircle,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
const COPILOT_SUGGESTIONS = [
  {
    icon: Layers,
    label: "Explain TraceLayer agents",
    prompt: "Explain how the 10 AI agents work together in TraceLayer. What does each agent do and how do they coordinate?",
    category: "Platform",
  },
  {
    icon: BarChart3,
    label: "Project status overview",
    prompt: "Give me a summary of all my projects — their status, how many requirements each has, and highlight any issues.",
    category: "Analytics",
  },
  {
    icon: Zap,
    label: "Suggest next steps",
    prompt: "Based on my current projects and data, what should I focus on next? Give me actionable recommendations.",
    category: "Guidance",
  },
  {
    icon: FileText,
    label: "How to generate a BRD",
    prompt: "Walk me through the process of generating a BRD document from uploaded sources.",
    category: "Workflow",
  },
  {
    icon: Users,
    label: "Stakeholder insights",
    prompt: "Give me a cross-project stakeholder overview. Who are the key stakeholders and what's their influence?",
    category: "Intelligence",
  },
  {
    icon: Network,
    label: "Integration guide",
    prompt: "How do I connect external tools like Slack, Jira, or GitHub to TraceLayer? What data does each integration pull?",
    category: "Setup",
  },
];

// ─── Page Context Detection ───────────────────────────────────────────────────
function getPageContext(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/projects") return "Projects List";
  if (pathname.includes("/brd")) return "BRD Viewer";
  if (pathname.includes("/graph")) return "Knowledge Graph";
  if (pathname.includes("/analytics")) return "Analytics";
  if (pathname.includes("/pipeline")) return "Pipeline Logs";
  if (pathname.includes("/controls")) return "Control Center";
  if (pathname.includes("/projects/new")) return "New Project";
  if (pathname.includes("/projects/")) return "Project Workspace";
  if (pathname === "/integrations") return "Integrations";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/help") return "Help";
  return "Unknown";
}

// ─── Follow-up Suggestions (context-aware) ────────────────────────────────────
const FOLLOW_UP_MAP: Record<string, { label: string; prompt: string }[]> = {
  Dashboard: [
    { label: "Show project health summary", prompt: "Give me a health check across all my projects — any conflicts, low-confidence requirements, or missing data I should address?" },
    { label: "What should I work on next?", prompt: "Based on the current state of my projects, what's the highest-priority action I should take right now?" },
    { label: "Explain the pipeline stages", prompt: "Walk me through each stage of the extraction pipeline and what happens at each step." },
  ],
  "Project Workspace": [
    { label: "Summarize this project", prompt: "Give me a concise summary of this project — how many requirements, stakeholders, conflicts, and what's the overall confidence?" },
    { label: "Find requirement gaps", prompt: "Are there any gaps in the requirements for this project? What areas might be under-specified?" },
    { label: "Who are the key stakeholders?", prompt: "List the most influential stakeholders in this project and their roles." },
    { label: "Generate a status report", prompt: "Generate a brief status report for this project that I could share with stakeholders." },
  ],
  "BRD Viewer": [
    { label: "Improve the executive summary", prompt: "How could the executive summary of this BRD be improved? Suggest specific enhancements." },
    { label: "Check requirement coverage", prompt: "Are there any requirements that lack source traceability? Which areas have low coverage?" },
    { label: "Identify risks I may have missed", prompt: "Based on the BRD content, are there any risks or conflicts I might have overlooked?" },
  ],
  "Knowledge Graph": [
    { label: "Explain the graph structure", prompt: "Explain how the knowledge graph connects sources, requirements, stakeholders, and decisions." },
    { label: "Find disconnected nodes", prompt: "Are there any entities in my knowledge graph that aren't well connected? What should I link better?" },
  ],
  Integrations: [
    { label: "Which integration should I add?", prompt: "Based on my project needs, which integrations would be most valuable to connect next?" },
    { label: "How does data sync work?", prompt: "Explain how data flows from connected integrations into the BRD pipeline." },
  ],
  Analytics: [
    { label: "Interpret these metrics", prompt: "Help me understand the key metrics and what they mean for my project health." },
    { label: "Spot improvement areas", prompt: "Based on the analytics data, where should I focus to improve my BRD quality?" },
  ],
};

const GENERIC_FOLLOW_UPS: { label: string; prompt: string }[] = [
  { label: "Tell me more", prompt: "Can you elaborate on that? Give me more details and examples." },
  { label: "What should I do next?", prompt: "Based on what you just told me, what's the best next step I should take?" },
  { label: "Summarize key points", prompt: "Summarize the key takeaways from your last response in bullet points." },
];

function getFollowUpSuggestions(page: string, messageCount: number): { label: string; prompt: string }[] {
  const contextual = FOLLOW_UP_MAP[page] || [];
  // Mix: pick up to 2 contextual + 1 generic, rotate based on message count to keep them fresh
  const ctxStart = (Math.floor(messageCount / 2)) % Math.max(contextual.length, 1);
  const picked: { label: string; prompt: string }[] = [];
  for (let i = 0; i < Math.min(2, contextual.length); i++) {
    picked.push(contextual[(ctxStart + i) % contextual.length]);
  }
  const genIdx = (Math.floor(messageCount / 2)) % GENERIC_FOLLOW_UPS.length;
  picked.push(GENERIC_FOLLOW_UPS[genIdx]);
  return picked;
}

// ─── Simple Markdown Parser ───────────────────────────────────────────────────
function parseMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted/50 rounded-lg p-3 my-2 text-[12px] overflow-x-auto border border-border/40"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-[12px] border border-border/30">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-[13px] mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-[14px] mt-4 mb-1.5">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-[15px] mt-4 mb-2">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 text-[12.5px] leading-relaxed list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-3 text-[12.5px] leading-relaxed list-decimal">$1. $2</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// ─── Message Component ────────────────────────────────────────────────────────
function CopilotMessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
        isUser
          ? "bg-primary/15 text-primary"
          : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
        isUser
          ? "bg-primary text-primary-foreground ml-auto rounded-tr-md"
          : "bg-muted/60 text-foreground border border-border/40 rounded-tl-md"
      }`}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div
            className="prose-copilot"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Copilot Component ───────────────────────────────────────────────────
export function AICopilot() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic">("gemini");
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Query stored API keys
  const storedKeyGemini = useQuery(api.apiKeys.getKeyForProvider, { provider: "gemini" });
  const storedKeyOpenai = useQuery(api.apiKeys.getKeyForProvider, { provider: "openai" });
  const storedKeyAnthropic = useQuery(api.apiKeys.getKeyForProvider, { provider: "anthropic" });

  const copilotAction = useAction(api.copilot.globalChat);

  // Auto-select provider with available key
  useEffect(() => {
    if (storedKeyGemini) setProvider("gemini");
    else if (storedKeyOpenai) setProvider("openai");
    else if (storedKeyAnthropic) setProvider("anthropic");
  }, [storedKeyGemini, storedKeyOpenai, storedKeyAnthropic]);

  // Get API key for current provider
  const getApiKey = useCallback((): string | null => {
    if (provider === "gemini") return storedKeyGemini || null;
    if (provider === "openai") return storedKeyOpenai || null;
    if (provider === "anthropic") return storedKeyAnthropic || null;
    return null;
  }, [provider, storedKeyGemini, storedKeyOpenai, storedKeyAnthropic]);

  // Keyboard shortcut: Ctrl+J
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Extract project ID from URL
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] && projectMatch[1] !== "new" ? projectMatch[1] : undefined;

  // Send message
  const handleSend = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || sending) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setError("No API key configured. Go to Settings → API Keys to add one.");
      return;
    }

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const result = await copilotAction({
        userMessage: content,
        provider,
        apiKey,
        context: {
          currentPage: getPageContext(location.pathname),
          activeProjectId,
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        },
      });

      const assistantMsg: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to get response";
      setError(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const providerInfo = {
    gemini: { label: "Gemini", color: "#4285F4", hasKey: !!storedKeyGemini },
    openai: { label: "GPT-4o", color: "#10A37F", hasKey: !!storedKeyOpenai },
    anthropic: { label: "Claude", color: "#CC785C", hasKey: !!storedKeyAnthropic },
  };

  const panelWidth = isExpanded ? "w-[560px]" : "w-[420px]";

  return (
    <>
      {/* ─── Floating Trigger Button ──────────────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary via-violet-600 to-indigo-700 text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center group"
            aria-label="Open AI Copilot (Ctrl+J)"
            title="AI Copilot — Ctrl+J"
          >
            <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping opacity-30" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Backdrop ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* ─── Slide-Out Panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed top-0 right-0 bottom-0 z-50 ${panelWidth} bg-background border-l border-border/60 flex flex-col shadow-2xl`}
          >
            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 py-4 border-b border-border/40 bg-gradient-to-r from-primary/5 via-violet-500/3 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-md shadow-primary/25">
                    <Bot className="w-4.5 h-4.5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-1.5">
                      TraceLayer Copilot
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {getPageContext(location.pathname)} • {providerInfo[provider].label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  {messages.length > 0 && (
                    <button
                      onClick={clearChat}
                      className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="Clear conversation"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Provider Picker */}
              <div className="mt-3 flex items-center gap-2">
                {(Object.entries(providerInfo) as [string, any][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => info.hasKey && setProvider(key as any)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                      provider === key
                        ? "border-primary/40 bg-primary/10 text-primary font-medium"
                        : info.hasKey
                          ? "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                          : "border-border/20 text-muted-foreground/40 cursor-not-allowed"
                    }`}
                    disabled={!info.hasKey}
                  >
                    {info.label}
                    {!info.hasKey && " ✗"}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                  <Keyboard className="w-3 h-3 inline mr-1" />Ctrl+J
                </span>
              </div>
            </div>

            {/* ─── Messages Area ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  {/* Welcome State */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5 max-w-sm"
                  >
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center border border-primary/10">
                      <Cpu className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-foreground mb-1">
                        Hey! I'm your AI Copilot
                      </h3>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">
                        I know everything about your projects, agents, and pipeline.
                        Ask me anything — or try a suggestion below.
                      </p>
                    </div>

                    {/* Quick Suggestions */}
                    <div className="space-y-2">
                      {COPILOT_SUGGESTIONS.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.06 }}
                          onClick={() => handleSend(s.prompt)}
                          disabled={sending}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 text-left transition-all group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15">
                            <s.icon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground truncate">{s.label}</p>
                            <p className="text-[10px] text-muted-foreground">{s.category}</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <CopilotMessageBubble key={msg.id} message={msg} />
                  ))}

                  {/* Typing indicator */}
                  {sending && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-md px-4 py-3">
                        <div className="flex gap-1.5">
                          <motion.div className="w-2 h-2 rounded-full bg-primary/60" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} />
                          <motion.div className="w-2 h-2 rounded-full bg-primary/60" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} />
                          <motion.div className="w-2 h-2 rounded-full bg-primary/60" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Follow-up suggestion chips — show after last assistant reply */}
                  {!sending && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-wrap gap-2 pt-1"
                    >
                      {getFollowUpSuggestions(getPageContext(location.pathname), messages.length).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s.prompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-[11px] font-medium text-primary hover:bg-primary/10 hover:border-primary/30 transition-all"
                        >
                          <Sparkles className="w-3 h-3" />
                          {s.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </>
              )}

              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Input Area ─────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-border/30">
              <div className="flex items-end gap-2 bg-muted/40 border border-border/50 rounded-2xl px-3.5 py-2.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your projects..."
                  rows={1}
                  className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/50 resize-none outline-none min-h-[24px] max-h-[120px]"
                  style={{ fieldSizing: "content" } as any}
                  disabled={sending}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending}
                  className="shrink-0 w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
                Powered by TraceLayer AI • {providerInfo[provider].label} • Press Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
