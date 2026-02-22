/**
 * LandingPage — Bold, high-contrast entry for TraceLayer.
 * Uses asymmetric layouts, visible gradients, glassmorphism cards,
 * animated grid, terminal demo, bento feature grid, and editorial type.
 */
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import {
  Database,
  GitBranch,
  FileText,
  Users,
  Zap,
  Clock,
  AlertTriangle,
  Network,
  Layers,
  ArrowRight,
  Sparkles,
  Upload,
  Brain,
  Rocket,
  ChevronDown,
  Shield,
  GitMerge,
  BarChart3,
  Link2,
  Moon,
  Sun,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

/* ═══ Data ════════════════════════════════════════════════════════════════ */
const AGENTS = [
  { name: "Ingestion", role: "Source parsing & extraction", icon: Database, color: "#E8A838", bg: "#E8A83818" },
  { name: "Classification", role: "Type & relevance scoring", icon: GitBranch, color: "#8B5CF6", bg: "#8B5CF618" },
  { name: "Requirement", role: "Requirement extraction", icon: FileText, color: "#3B82F6", bg: "#3B82F618" },
  { name: "Stakeholder", role: "People & influence mapping", icon: Users, color: "#66BB8C", bg: "#66BB8C18" },
  { name: "Decision", role: "Rationale analysis", icon: Zap, color: "#F97316", bg: "#F9731618" },
  { name: "Timeline", role: "Temporal & milestone mapping", icon: Clock, color: "#06B6D4", bg: "#06B6D418" },
  { name: "Conflict", role: "Contradiction detection", icon: AlertTriangle, color: "#EF4444", bg: "#EF444418" },
  { name: "Traceability", role: "Knowledge graph links", icon: Network, color: "#EC4899", bg: "#EC489918" },
  { name: "Document", role: "BRD generation", icon: FileText, color: "#10B981", bg: "#10B98118" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "9 Agents, One Mind",
    desc: "Not one model doing everything — nine specialized agents that reason, cross-check, and build the BRD together.",
    gradient: "from-violet-500/20 to-indigo-500/20",
    iconColor: "#818CF8",
    span: "md:col-span-2",
    preview: "agent-grid",
  },
  {
    icon: Shield,
    title: "Conflict Detection",
    desc: "Automated contradiction spotting across requirements before they ship.",
    gradient: "from-red-500/20 to-orange-500/20",
    iconColor: "#EF4444",
    span: "",
    preview: "conflict",
  },
  {
    icon: GitMerge,
    title: "Full Traceability",
    desc: "Every requirement linked to its source. Click any line, see where it came from.",
    gradient: "from-emerald-500/20 to-cyan-500/20",
    iconColor: "#10B981",
    span: "",
    preview: "trace",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    desc: "Coverage gaps, stakeholder influence, requirement quality — all surfaced automatically.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "#06B6D4",
    span: "",
    preview: "chart",
  },
  {
    icon: Sparkles,
    title: "AI Copilot",
    desc: "Ask anything about your project. The copilot reasons across all agents and sources to answer instantly.",
    gradient: "from-amber-500/20 to-yellow-500/20",
    iconColor: "#F59E0B",
    span: "",
    preview: "copilot",
  },
  {
    icon: Link2,
    title: "Knowledge Graph",
    desc: "Interactive force-directed graph showing how everything connects — requirements, people, decisions.",
    gradient: "from-pink-500/20 to-violet-500/20",
    iconColor: "#EC4899",
    span: "md:col-span-2",
    preview: "graph",
  },
];

const COMPARISONS = [
  { traditional: "Manually read hundreds of pages", tracelayer: "Auto-ingest from any source" },
  { traditional: "Requirements lost in email threads", tracelayer: "Every requirement traced to origin" },
  { traditional: "Conflicts found in production", tracelayer: "Conflicts detected before they ship" },
  { traditional: "Static Word documents", tracelayer: "Living BRD, always up to date" },
  { traditional: "Weeks of manual analysis", tracelayer: "Seconds with 9 AI agents" },
];

const STEPS = [
  { num: "01", title: "Feed", icon: Upload, color: "#E8A838", desc: "Connect Slack, Drive, Jira, Confluence — or just drag-and-drop documents. Meeting transcripts, emails, specs — all of it." },
  { num: "02", title: "Think", icon: Brain, color: "#818CF8", desc: "Nine agents work in parallel: extracting requirements, mapping stakeholders, detecting conflicts, building a knowledge graph." },
  { num: "03", title: "Ship", icon: Rocket, color: "#34D399", desc: "A living BRD updates in real-time. Every requirement traced to its source. Export, share, iterate." },
];

const STATS = [
  { value: "9", label: "AI Agents" },
  { value: "< 30s", label: "Analysis Time" },
  { value: "100%", label: "Traceable" },
  { value: "Real-time", label: "Collaboration" },
];

/* ═══ Animated Grid Background ═══════════════════════════════════════════ */
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(129, 140, 248, 0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(129, 140, 248, 0.5) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 50%, transparent 30%, var(--background) 80%)",
      }} />
    </div>
  );
}

/* ═══ Floating Agent Constellation ═══════════════════════════════════════ */
function AgentConstellation() {
  const positions = AGENTS.map((_, i) => {
    const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 140;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0],
    [0, 4], [2, 6], [1, 7], [3, 8], [5, 0],
  ];

  return (
    <div className="relative w-[340px] h-[340px] lg:w-[400px] lg:h-[400px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="-180 -180 360 360">
        {[60, 100, 140].map((r, i) => (
          <motion.circle
            key={`ring-${i}`}
            cx={0} cy={0} r={r}
            fill="none"
            stroke="rgba(129, 140, 248, 0.08)"
            strokeWidth={1}
            strokeDasharray="4 8"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{
              opacity: { delay: 0.4 + i * 0.2, duration: 0.6 },
              rotate: { duration: 40 + i * 20, repeat: Infinity, ease: "linear" },
            }}
          />
        ))}
        {connections.map(([a, b], i) => (
          <motion.line
            key={`c-${i}`}
            x1={positions[a].x} y1={positions[a].y}
            x2={positions[b].x} y2={positions[b].y}
            stroke="rgba(129, 140, 248, 0.15)"
            strokeWidth={1.5}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.05, duration: 0.5 }}
          />
        ))}
        {[0, 3, 6, 9].map((ci) => {
          const [a, b] = connections[ci];
          return (
            <motion.circle
              key={`pulse-${ci}`}
              r={2}
              fill="#818CF8"
              initial={{ cx: positions[a].x, cy: positions[a].y, opacity: 0 }}
              animate={{
                cx: [positions[a].x, positions[b].x, positions[a].x],
                cy: [positions[a].y, positions[b].y, positions[a].y],
                opacity: [0, 0.8, 0],
              }}
              transition={{ delay: 2 + ci * 0.3, duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
          );
        })}
      </svg>

      {AGENTS.map((agent, i) => {
        const Icon = agent.icon;
        return (
          <motion.div
            key={agent.name}
            className="absolute group"
            style={{
              left: `calc(50% + ${positions[i].x}px - 20px)`,
              top: `calc(50% + ${positions[i].y}px - 20px)`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 200 }}
          >
            <motion.div
              animate={{ y: [0, -4, 0, 4, 0] }}
              transition={{ delay: 1.2 + i * 0.25, duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border-[1.5px] backdrop-blur-sm shadow-lg transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: agent.bg,
                  borderColor: `${agent.color}40`,
                  boxShadow: `0 0 20px ${agent.color}15`,
                }}
              >
                <Icon className="w-[18px] h-[18px]" style={{ color: agent.color }} />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[10px] text-foreground/60 whitespace-nowrap bg-foreground/5 backdrop-blur-sm px-2 py-0.5 rounded-md border border-foreground/10">{agent.name}</span>
              </div>
            </motion.div>
          </motion.div>
        );
      })}

      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 180 }}
      >
        <motion.div
          className="absolute -inset-3 rounded-2xl border border-indigo-400/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -inset-6 rounded-3xl border border-indigo-400/5"
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        />
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border-[1.5px] border-indigo-400/30 flex items-center justify-center shadow-xl shadow-indigo-500/15">
          <Layers className="w-7 h-7 text-primary" />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══ Feature mini-preview visuals ═══════════════════════════════════════ */
function FeaturePreview({ type }: { type: string }) {
  if (type === "agent-grid") {
    return (
      <div className="mt-5 flex flex-wrap gap-1.5">
        {AGENTS.slice(0, 6).map((a) => {
          const I = a.icon;
          return (
            <div key={a.name} className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-foreground/[0.06] bg-foreground/[0.02] text-[10px] text-muted-foreground/80">
              <I className="w-3 h-3" style={{ color: a.color }} />
              {a.name}
            </div>
          );
        })}
        <div className="flex items-center px-2 py-1 rounded-md border border-foreground/[0.06] bg-foreground/[0.02] text-[10px] text-muted-foreground/50">+3 more</div>
      </div>
    );
  }
  if (type === "conflict") {
    return (
      <div className="mt-5 space-y-1.5">
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/80">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span>REQ-12 <span className="text-red-400">conflicts with</span> REQ-31</span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/80">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>REQ-05 <span className="text-amber-400">overlaps</span> REQ-22</span>
        </div>
      </div>
    );
  }
  if (type === "trace") {
    return (
      <div className="mt-5 space-y-1">
        {["Meeting Notes → REQ-01", "Slack #eng → REQ-14", "PRD v2.doc → REQ-07"].map((t) => (
          <div key={t} className="flex items-center gap-2 text-[10.5px] text-muted-foreground/70">
            <ArrowRight className="w-3 h-3 text-emerald-400/60" />
            <span>{t}</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "chart") {
    return (
      <div className="mt-5 flex items-end gap-1 h-10">
        {[65, 82, 45, 90, 70, 55, 88].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm bg-cyan-400/30"
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
          />
        ))}
      </div>
    );
  }
  if (type === "copilot") {
    return (
      <div className="mt-5 space-y-1.5">
        <div className="flex items-start gap-2 text-[10.5px] text-muted-foreground/60">
          <Sparkles className="w-3 h-3 text-amber-400/70 mt-0.5 shrink-0" />
          <span className="italic">"Which requirements lack stakeholder approval?"</span>
        </div>
        <div className="flex items-start gap-2 text-[10.5px] text-foreground/50">
          <ArrowRight className="w-3 h-3 text-amber-400/50 mt-0.5 shrink-0" />
          <span>REQ-08, REQ-14, REQ-22 — 3 pending</span>
        </div>
      </div>
    );
  }
  if (type === "graph") {
    return (
      <div className="mt-5 relative h-14">
        <svg className="w-full h-full" viewBox="0 0 200 56">
          {[[30,20,80,15],[80,15,140,35],[140,35,180,12],[30,20,100,45],[100,45,140,35],[80,15,100,45]].map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(236,72,153,0.2)" strokeWidth={1} />
          ))}
          {[[30,20,"#818CF8"],[80,15,"#3B82F6"],[140,35,"#EC4899"],[180,12,"#10B981"],[100,45,"#F97316"]].map(([cx,cy,c], i) => (
            <circle key={i} cx={cx as number} cy={cy as number} r={4} fill={c as string} opacity={0.6} />
          ))}
        </svg>
      </div>
    );
  }
  return null;
}

/* ═══ Terminal-style pipeline demo ═══════════════════════════════════════ */
function PipelineDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const lines = [
    { agent: "Ingestion", color: "#E8A838", text: "Parsed 3 documents → 47 chunks extracted", ms: "1.2s" },
    { agent: "Classification", color: "#8B5CF6", text: "Identified: Functional(23), Non-Functional(12), Constraint(8)", ms: "2.4s" },
    { agent: "Requirement", color: "#3B82F6", text: "Extracted 43 requirements with confidence > 0.85", ms: "4.1s" },
    { agent: "Stakeholder", color: "#66BB8C", text: "Mapped 7 stakeholders across 3 departments", ms: "5.8s" },
    { agent: "Decision", color: "#F97316", text: '5 decisions found: "Migrate to microservices" → HIGH', ms: "7.3s" },
    { agent: "Conflict", color: "#EF4444", text: "⚠ 2 conflicts: REQ-12 contradicts REQ-31", ms: "9.0s" },
    { agent: "Traceability", color: "#EC4899", text: "Graph built: 156 nodes, 284 edges — fully connected", ms: "11.2s" },
    { agent: "Document", color: "#10B981", text: "BRD generated: 12 sections, 43 reqs, 100% traced ✓", ms: "12.8s" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((s) => {
        if (s >= lines.length - 1) {
          setCycle((c) => c + 1);
          return 0;
        }
        return s + 1;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const progress = ((activeStep + 1) / lines.length) * 100;
  const isComplete = activeStep === lines.length - 1;

  return (
    <motion.div
      className="w-full max-w-3xl rounded-2xl border border-foreground/[0.08] bg-card/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-foreground/[0.06] bg-foreground/[0.02]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[11px] text-muted-foreground/60 ml-2 font-mono">tracelayer — pipeline.run()</span>
        </div>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-primary/60 font-mono">
              <Loader2 className="w-3 h-3 animate-spin" /> Processing
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-foreground/[0.03]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: isComplete ? "#10B981" : "linear-gradient(90deg, #818CF8, #a78bfa)" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Log lines */}
      <div className="p-5 font-mono text-[12px] space-y-2 min-h-[300px]">
        <div className="text-[10px] text-muted-foreground/30 mb-3">$ tracelayer pipeline --source="project-docs/" --agents=all</div>
        {lines.map((line, i) => (
          <motion.div
            key={`${cycle}-${i}`}
            className="flex items-start gap-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: i <= activeStep ? 1 : 0.08, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Status icon */}
            <div className="shrink-0 mt-1">
              {i < activeStep ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400/70" />
              ) : i === activeStep ? (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: line.color }} />
              ) : (
                <div className="w-3 h-3 rounded-full border border-foreground/10" />
              )}
            </div>
            {/* Agent badge */}
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold min-w-[82px] text-center"
              style={{ color: i <= activeStep ? line.color : `${line.color}40`, backgroundColor: `${line.color}${i <= activeStep ? '18' : '08'}` }}
            >
              {line.agent}
            </span>
            {/* Text */}
            <span className={`leading-relaxed flex-1 transition-colors duration-300 ${i <= activeStep ? "text-foreground/70" : "text-muted-foreground/16"}`}>
              {line.text}
            </span>
            {/* Timestamp */}
            <span className={`shrink-0 text-[10px] tabular-nums ${i <= activeStep ? "text-muted-foreground/40" : "text-muted-foreground/10"}`}>
              {line.ms}
            </span>
          </motion.div>
        ))}
        {/* Summary line */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              className="mt-4 pt-3 border-t border-foreground/[0.06] flex items-center justify-between text-[11px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-emerald-400/80">✓ Pipeline complete — BRD ready</span>
              <span className="text-muted-foreground/40">8/8 agents • 12.8s total</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN LANDING PAGE                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -80]);

  // ── Theme state (synced with Layout via localStorage) ──────────────────
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('tracelayer-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) { root.classList.add('dark'); } else { root.classList.remove('dark'); }
    localStorage.setItem('tracelayer-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleEnter = () => {
    setEntered(true);
    localStorage.setItem("tracelayer-entered", "true");
    setTimeout(() => navigate("/"), 350);
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-indigo-500/30"
    >
      {/* Noise */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-600/[0.07] blur-[150px]" />
        <div className="absolute bottom-[-15%] left-[-8%] w-[40%] h-[50%] rounded-full bg-violet-500/[0.05] blur-[130px]" />
        <div className="absolute top-[35%] left-[25%] w-[25%] h-[25%] rounded-full bg-cyan-500/[0.03] blur-[100px]" />
      </div>

      {/* ════════ NAV ══════════════════════════════════════════════════ */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-40 px-6 sm:px-10 py-4 backdrop-blur-sm bg-background/50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/25 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Layers className="w-[18px] h-[18px] text-primary" />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-foreground/90">
              TraceLayer
            </span>
          </div>

          <div className="flex items-center gap-5">
            <a href="#how" className="hidden sm:block text-[13px] text-muted-foreground/80 hover:text-foreground/70 transition-colors">How it works</a>
            <a href="#features" className="hidden sm:block text-[13px] text-muted-foreground/80 hover:text-foreground/70 transition-colors">Features</a>
            <a href="#pipeline" className="hidden sm:block text-[13px] text-muted-foreground/80 hover:text-foreground/70 transition-colors">Pipeline</a>
            {/* Theme toggle */}
            <button
              onClick={() => setIsDark((v) => !v)}
              className="w-9 h-9 rounded-lg bg-foreground/[0.06] border border-foreground/[0.1] flex items-center justify-center text-muted-foreground hover:text-foreground/80 hover:bg-foreground/[0.1] transition-all"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleEnter}
              className="text-[13px] px-5 py-2 rounded-lg bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/80 hover:bg-foreground/[0.14] hover:text-foreground transition-all font-medium"
            >
              Enter App →
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ════════ HERO ═════════════════════════════════════════════════ */}
      <motion.section className="relative min-h-screen flex items-center px-6" style={{ y: heroY }}>
        <GridBackground />

        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center gap-10 lg:gap-16 pt-20">
          {/* Left: Copy */}
          <motion.div
            className="flex-1 max-w-2xl text-center lg:text-left z-10"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[12px] text-primary mb-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Multi-Agent Intelligence
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              Live Pipeline
            </motion.div>

            <h1
              className="text-[clamp(3rem,6vw,5rem)] leading-[1.05] tracking-tight mb-6"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              <motion.span
                className="block text-foreground"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                Requirements,
              </motion.span>
              <motion.span
                className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.6 }}
              >
                understood.
              </motion.span>
            </h1>

            <motion.p
              className="text-[17px] sm:text-[18px] leading-[1.75] text-muted-foreground max-w-lg mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.6 }}
            >
              TraceLayer turns scattered documents, meetings, and messages into
              structured, traceable requirements — with a fleet of{" "}
              <span className="text-primary font-medium">9 AI agents</span>{" "}
              that reason together in real-time.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <motion.button
                onClick={handleEnter}
                className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold text-[15px] transition-all duration-300 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Enter TraceLayer
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <span className="text-[13px] text-muted-foreground/60">
                No account required
              </span>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex items-center gap-8 sm:gap-10 mt-14 justify-center lg:justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className="text-[22px] font-bold bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em] mt-0.5">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Constellation */}
          <motion.div
            className="flex-shrink-0 relative z-10"
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
          >
            <div className="absolute inset-0 -m-16 bg-indigo-500/[0.06] rounded-full blur-[80px]" />
            <AgentConstellation />
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">Scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ════════ HOW IT WORKS — Alternating Timeline ═════════════════ */}
      <section id="how" className="relative py-32 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-20 bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent" />

        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <span className="text-[11px] uppercase tracking-[0.3em] text-primary/70 block mb-4">
              How it works
            </span>
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] text-foreground/90 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Three acts. One living document.
            </h2>
          </motion.div>

          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-foreground/0 via-foreground/10 to-foreground/0 hidden md:block" />

            <div className="space-y-16 md:space-y-0">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isLeft = i % 2 === 0;
                return (
                  <motion.div
                    key={step.num}
                    className={`md:flex items-center gap-10 ${i > 0 ? "md:mt-10" : ""}`}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: i * 0.1, duration: 0.6 }}
                  >
                    {!isLeft && <div className="hidden md:block md:flex-1" />}

                    <div className={`md:flex-1 ${isLeft ? "md:pr-16 md:text-right" : "md:pl-16 md:text-left"}`}>
                      <div className={`flex items-center gap-4 mb-4 ${isLeft ? "md:justify-end" : ""}`}>
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center border-[1.5px] shadow-lg"
                          style={{
                            backgroundColor: `${step.color}15`,
                            borderColor: `${step.color}30`,
                            boxShadow: `0 4px 24px ${step.color}15`,
                          }}
                        >
                          <Icon className="w-5 h-5" style={{ color: step.color }} />
                        </div>
                        <div>
                          <span className="text-[11px] font-mono tracking-wider block" style={{ color: step.color }}>
                            {step.num}
                          </span>
                          <h3
                            className="text-[28px] text-foreground/90"
                            style={{ fontFamily: "'DM Serif Display', serif" }}
                          >
                            {step.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-[14.5px] leading-[1.75] text-muted-foreground max-w-md">
                        {step.desc}
                      </p>
                    </div>

                    <div className="hidden md:flex items-center justify-center w-4">
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 shadow-md"
                        style={{ borderColor: step.color, backgroundColor: `${step.color}30`, boxShadow: `0 0 12px ${step.color}30` }}
                      />
                    </div>

                    {isLeft && <div className="hidden md:block md:flex-1" />}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FEATURES — Bento Grid ══════════════════════════════ */}
      <section id="features" className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[11px] uppercase tracking-[0.3em] text-primary/70 block mb-4">
              Built different
            </span>
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] text-foreground/90 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Not another doc generator.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  className={`group relative p-7 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] hover:bg-foreground/[0.05] overflow-hidden transition-all duration-300 ${feat.span}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center border"
                        style={{
                          backgroundColor: `${feat.iconColor}15`,
                          borderColor: `${feat.iconColor}30`,
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: feat.iconColor }} />
                      </div>
                      <div className="w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: feat.iconColor }} />
                    </div>
                    <h3 className="text-[17px] font-semibold text-foreground/90 mb-2">{feat.title}</h3>
                    <p className="text-[13.5px] leading-[1.7] text-muted-foreground">{feat.desc}</p>
                    <FeaturePreview type={feat.preview} />
                  </div>

                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(90deg, transparent, ${feat.iconColor}40, transparent)` }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ LIVE PIPELINE DEMO ═════════════════════════════════ */}
      <section id="pipeline" className="relative py-32 px-6">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/[0.02] to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[11px] uppercase tracking-[0.3em] text-primary/70 block mb-4">
              Watch it work
            </span>
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] text-foreground/90 tracking-tight mb-4"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              9 agents. 30 seconds. Full BRD.
            </h2>
            <p className="text-[15px] text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
              Watch the pipeline process documents in real-time. Each agent reports back
              as it finishes — ingestion to generation.
            </p>
          </motion.div>

          <div className="flex justify-center">
            <PipelineDemo />
          </div>

          {/* Pipeline stats banner below demo */}
          <motion.div
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            {[
              { val: "8", label: "Agents Used", icon: Brain },
              { val: "43", label: "Requirements", icon: FileText },
              { val: "156", label: "Graph Nodes", icon: Network },
              { val: "2", label: "Conflicts Found", icon: AlertTriangle },
            ].map((s) => {
              const I = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02]">
                  <I className="w-4 h-4 text-indigo-400/50" />
                  <div>
                    <div className="text-[16px] font-bold text-foreground/80">{s.val}</div>
                    <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ════════ COMPARISON: Traditional vs TraceLayer ═══════════════ */}
      <section className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[11px] uppercase tracking-[0.3em] text-primary/70 block mb-4">
              Why TraceLayer
            </span>
            <h2
              className="text-[clamp(1.6rem,3vw,2.4rem)] text-foreground/90 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Traditional vs. Intelligent
            </h2>
          </motion.div>

          <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.015] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2 gap-0 border-b border-foreground/[0.06]">
              <div className="px-6 py-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400/60" />
                <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Traditional</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 border-l border-foreground/[0.06] bg-indigo-500/[0.03]">
                <Layers className="w-4 h-4 text-primary/70" />
                <span className="text-[12px] font-semibold text-primary/70 uppercase tracking-wider">TraceLayer</span>
              </div>
            </div>
            {/* Rows */}
            {COMPARISONS.map((row, i) => (
              <motion.div
                key={i}
                className="grid grid-cols-2 gap-0 border-b border-foreground/[0.04] last:border-b-0"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="px-6 py-3.5 text-[13px] text-muted-foreground/60 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/30 shrink-0" />
                  {row.traditional}
                </div>
                <div className="px-6 py-3.5 text-[13px] text-foreground/60 flex items-center gap-2 border-l border-foreground/[0.06] bg-indigo-500/[0.02]">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 shrink-0" />
                  {row.tracelayer}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ AGENT FLEET GRID ═══════════════════════════════════ */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60 block mb-3">
              The Fleet
            </span>
          </motion.div>

          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-3">
            {AGENTS.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <motion.div
                  key={agent.name}
                  className="group flex items-center gap-4 py-4 px-5 rounded-xl border border-foreground/[0.06] bg-foreground/[0.025] hover:bg-foreground/[0.05] hover:border-foreground/[0.12] transition-all duration-200"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: agent.bg,
                      borderColor: `${agent.color}25`,
                    }}
                  >
                    <Icon className="w-[18px] h-[18px]" style={{ color: agent.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground/70">{agent.name}</div>
                    <div className="text-[11px] text-muted-foreground/50 truncate">{agent.role}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ═════════════════════════════════════════ */}
      <section className="relative py-32 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.06] blur-[150px] pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div
            className="w-16 h-[2px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent mx-auto mb-12"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
          />

          <motion.h2
            className="text-[clamp(1.8rem,3.5vw,2.8rem)] text-foreground/90 tracking-tight mb-5"
            style={{ fontFamily: "'DM Serif Display', serif" }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            See it in action.
          </motion.h2>

          <motion.p
            className="text-[15px] text-muted-foreground/80 mb-10 max-w-md mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Jump straight into the platform. Explore a demo project, run the
            pipeline, and watch 9 agents build a BRD from scratch.
          </motion.p>

          <motion.button
            onClick={handleEnter}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-foreground text-background font-semibold text-[15px] transition-all duration-200 hover:bg-foreground/90 shadow-2xl shadow-foreground/10 hover:shadow-foreground/15"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            Start Exploring
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          <p className="mt-6 text-[12px] text-muted-foreground/50">
            No sign-up required. Jump straight in.
          </p>

          {/* Tech badges */}
          <div className="flex flex-wrap justify-center gap-3 mt-16">
            {["React 18", "Convex", "Multi-Agent AI", "Real-time Sync", "TypeScript", "Knowledge Graphs"].map((t) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-[11px] text-muted-foreground/70 font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════════════════════════════════════════ */}
      <footer className="border-t border-foreground/[0.06] py-8 px-6 sm:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center">
              <Layers className="w-3 h-3 text-indigo-400/60" />
            </div>
            <span className="text-[12px] text-muted-foreground/50">TraceLayer © 2026 </span>
          </div>
          <span className="text-[11px] text-muted-foreground/40">Built for GDG HackFest 2.0 2026</span>
        </div>
      </footer>

      {/* Page exit overlay */}
      <AnimatePresence>
        {entered && (
          <motion.div
            className="fixed inset-0 z-[100] bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
