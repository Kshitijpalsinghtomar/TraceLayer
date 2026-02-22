/**
 * DashboardLive — Agent Command Center
 * Polished dashboard with stats, charts, agent fleet, projects, and live activity.
 */
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNavigate } from "react-router";
import {
  Plus,
  FileText,
  Users,
  Database,
  Zap,
  Network,
  AlertTriangle,
  Cpu,
  GitBranch,
  Clock,
  Terminal,
  Activity,
  ArrowRight,
  Layers,
  Puzzle,
  Play,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  SlidersHorizontal,
  Rocket,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
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
import { SmartInsights } from "./SmartInsights";

// ─── Agent Definitions ────────────────────────────────────────────────────────
const AGENTS = [
  { id: "orchestrator", name: "Orchestrator", role: "Pipeline coordination", icon: Cpu, color: "#6B7AE8" },
  { id: "ingestion_agent", name: "Ingestion", role: "Source parsing & extraction", icon: Database, color: "#E8A838" },
  { id: "classification_agent", name: "Classification", role: "Type & relevance scoring", icon: GitBranch, color: "#8B5CF6" },
  { id: "requirement_agent", name: "Requirement", role: "Requirement extraction", icon: FileText, color: "#3B82F6" },
  { id: "stakeholder_agent", name: "Stakeholder", role: "People & influence mapping", icon: Users, color: "#66BB8C" },
  { id: "decision_agent", name: "Decision", role: "Decision & rationale analysis", icon: Zap, color: "#F97316" },
  { id: "timeline_agent", name: "Timeline", role: "Temporal & milestone mapping", icon: Clock, color: "#06B6D4" },
  { id: "conflict_agent", name: "Conflict", role: "Contradiction detection", icon: AlertTriangle, color: "#EF4444" },
  { id: "traceability_agent", name: "Traceability", role: "Knowledge graph links", icon: Network, color: "#EC4899" },
  { id: "document_agent", name: "Document", role: "BRD/PRD generation", icon: FileText, color: "#10B981" },
];

const statusStyles: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  uploading: { label: "Uploading", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  processing: { label: "Processing", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
  extracted: { label: "Extracted", className: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400" },
  generating: { label: "Generating", className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
};

const LEVEL_COLORS: Record<string, string> = {
  info: "#64748B",
  processing: "#3B82F6",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "#6B7AE8",
  ingestion_agent: "#E8A838",
  classification_agent: "#8B5CF6",
  requirement_agent: "#3B82F6",
  stakeholder_agent: "#66BB8C",
  decision_agent: "#F97316",
  timeline_agent: "#06B6D4",
  conflict_agent: "#EF4444",
  traceability_agent: "#EC4899",
  document_agent: "#10B981",
};

export function DashboardLive() {
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const stats = useQuery(api.projects.getStats);
  const recentActivity = useQuery(api.pipeline.getRecentActivity);
  const recentRuns = useQuery(api.pipeline.listAllRuns);
  const seedDemo = useMutation(api.demoSeed.seedDemoProject);
  const [seeding, setSeeding] = useState(false);

  const activeAgentIds = new Set(
    (recentActivity || []).map((log: any) => log.agent)
  );

  // ─── Chart Data ────────────────────────────────────────────────────────
  const projectStatusData = (projects || []).reduce((acc: any[], p: any) => {
    const status = p.status.charAt(0).toUpperCase() + p.status.slice(1);
    const existing = acc.find((d: any) => d.name === status);
    if (existing) existing.value++;
    else acc.push({ name: status, value: 1 });
    return acc;
  }, [] as Array<{ name: string; value: number }>);

  const projectStatusColors = ["#6B7AE8", "#22C55E", "#3B82F6", "#F97316", "#8B5CF6", "#EF4444", "#06B6D4"];

  const pipelineRunStatusData = (recentRuns || []).reduce((acc: any[], r: any) => {
    const status = r.status.replace(/_/g, " ");
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    const existing = acc.find((d: any) => d.name === label);
    if (existing) existing.count++;
    else acc.push({ name: label, count: 1 });
    return acc;
  }, [] as Array<{ name: string; count: number }>);

  function DashboardTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-[12px]">
        {label && <p className="font-medium mb-1">{label}</p>}
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const statCards = [
    { icon: FolderIcon, label: "Projects", value: stats?.totalProjects || 0, color: "#6B7AE8", bg: "from-indigo-500/10 to-indigo-500/5" },
    { icon: Zap, label: "Requirements", value: stats?.totalRequirements || 0, color: "#3B82F6", bg: "from-blue-500/10 to-blue-500/5" },
    { icon: Users, label: "Stakeholders", value: stats?.totalStakeholders || 0, color: "#66BB8C", bg: "from-emerald-500/10 to-emerald-500/5" },
    { icon: Database, label: "Sources", value: stats?.totalSources || 0, color: "#E8A838", bg: "from-amber-500/10 to-amber-500/5" },
    { icon: GitBranch, label: "Decisions", value: stats?.totalDecisions || 0, color: "#8B5CF6", bg: "from-violet-500/10 to-violet-500/5" },
    { icon: AlertTriangle, label: "Conflicts", value: stats?.totalConflicts || 0, color: "#EF4444", bg: "from-red-500/10 to-red-500/5" },
  ];

  // ─── First-time onboarding (zero projects) ──────────────────────────────
  const hasNoProjects = projects !== undefined && projects.length === 0;

  if (hasNoProjects) {
    return (
      <div className="px-10 py-8 max-w-[900px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/25">
            <Layers className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-[32px] tracking-[-0.03em] font-semibold text-foreground mb-3">
            Welcome to TraceLayer
          </h1>
          <p className="text-muted-foreground text-[16px] max-w-[520px] mx-auto leading-relaxed">
            Transform documents, meetings, and messages into structured Business Requirements Documents — automatically.
          </p>
        </motion.div>

        {/* Getting Started Steps */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-3 gap-5 mb-10"
        >
          {[
            {
              step: 1,
              title: "Create a Project",
              desc: "Start a new project to organize your BRD. Give it a name, description, and domain context.",
              icon: Plus,
              color: "#6B7AE8",
            },
            {
              step: 2,
              title: "Upload Sources",
              desc: "Drop in PDFs, meeting transcripts, emails, or connect integrations like Slack and Jira.",
              icon: Database,
              color: "#E8A838",
            },
            {
              step: 3,
              title: "Generate Your BRD",
              desc: "Our 10 AI agents extract requirements, stakeholders, conflicts, and produce a full BRD.",
              icon: FileText,
              color: "#22C55E",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-card border border-border/60 rounded-2xl p-6 relative overflow-hidden hover:border-primary/20 hover:shadow-lg transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1">
                  Step {item.step}
                </div>
                <h3 className="text-[15px] font-semibold mb-2">{item.title}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center justify-center gap-4"
        >
          <button
            onClick={() => navigate("/projects/new")}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-[15px] font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Create Your First Project
          </button>
          <button
            onClick={async () => {
              setSeeding(true);
              try { await seedDemo(); } finally { setSeeding(false); }
            }}
            disabled={seeding}
            className="flex items-center gap-2 bg-card border border-border px-8 py-3.5 rounded-xl text-[15px] font-medium text-foreground hover:bg-accent transition-all shadow-sm disabled:opacity-50"
          >
            <Rocket className="w-5 h-5 text-violet-500" />
            {seeding ? "Loading Demo..." : "Try a Demo Project"}
          </button>
        </motion.div>

        {/* Powered by section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-14 text-center"
        >
          <p className="text-[11px] text-muted-foreground/40 uppercase tracking-wider mb-4">Powered by 10 Specialized AI Agents</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {AGENTS.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border/40 text-[11px] text-muted-foreground"
              >
                <agent.icon className="w-3 h-3" style={{ color: agent.color }} />
                {agent.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-10 py-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-[28px] tracking-[-0.025em] font-semibold text-foreground">
                {greeting()}
              </h1>
              <Sparkles className="w-5 h-5 text-primary/60" />
            </div>
            <p className="text-muted-foreground text-[15px]">
              TraceLayer Intelligence Engine &mdash; {AGENTS.length} AI agents ready, {activeAgentIds.size} recently active
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/projects/new")}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid with gradient cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="grid grid-cols-6 gap-4 mb-8"
      >
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.08 + i * 0.04 }}
            className="relative overflow-hidden bg-card backdrop-blur-sm rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:border-primary/15 hover:-translate-y-0.5 transition-all duration-300 group cursor-default"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: `${stat.color}18`, boxShadow: `0 4px 12px ${stat.color}15` }}
                >
                  <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-emerald-500/50 transition-colors" />
              </div>
              <p className="text-[28px] tracking-[-0.03em] font-bold mb-0.5">{stat.value}</p>
              <p className="text-[12px] text-muted-foreground font-medium">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 gap-6 mb-8"
      >
        {/* Project Status Pie */}
        <div className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium">Project Status</h3>
            <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {projectStatusData.length} statuses
            </span>
          </div>
          {projectStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {projectStatusData.map((_: any, i: number) => (
                    <Cell key={i} fill={projectStatusColors[i % projectStatusColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DashboardTooltip />} />
                <Legend
                  formatter={(value: string) => <span className="text-[11px] text-muted-foreground">{value}</span>}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Network className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-[13px]">No projects yet</p>
            </div>
          )}
        </div>

        {/* Pipeline Run Results Bar */}
        <div className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium">Pipeline Runs</h3>
            <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {(recentRuns || []).length} total
            </span>
          </div>
          {pipelineRunStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineRunStatusData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<DashboardTooltip />} />
                <Bar dataKey="count" name="Runs" fill="#6B7AE8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Play className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-[13px]">No pipeline runs yet</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Insights Engine */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="mb-8"
      >
        <SmartInsights />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-[1fr_400px] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Agent Fleet */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-indigo-500/[0.03] to-violet-500/[0.03]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center shadow-sm">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                </div>
                <h2 className="text-[15px] font-medium">Agent Fleet</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {activeAgentIds.size} active
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  {AGENTS.length - activeAgentIds.size} idle
                </span>
              </div>
            </div>

            <div className="p-4 grid grid-cols-5 gap-3">
              {AGENTS.map((agent) => {
                const isActive = activeAgentIds.has(agent.id as any);
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.id}
                    className={`relative p-3.5 rounded-xl border transition-all duration-300 ${
                      isActive
                        ? "border-primary/25 bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.04] shadow-md shadow-primary/5"
                        : "border-border/40 hover:border-primary/15 hover:bg-accent/30 hover:shadow-sm"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500">
                        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
                      </span>
                    )}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                      style={{ backgroundColor: `${agent.color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: agent.color }} />
                    </div>
                    <p className="text-[12px] font-medium leading-tight">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{agent.role}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Projects */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-blue-500/[0.02] to-indigo-500/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-blue-500/15 flex items-center justify-center shadow-sm">
                  <FolderIcon className="w-3.5 h-3.5 text-primary" />
                </div>
                <h2 className="text-[15px] font-medium">Recent Projects</h2>
                {projects && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {projects.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/projects")}
                className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {projects === undefined ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse h-[72px] bg-muted/50 rounded-xl" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="px-6 py-16 text-center relative overflow-hidden">
                {/* Decorative gradient blobs */}
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
                
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/5">
                    <Network className="w-8 h-8 text-primary/50" />
                  </div>
                  <p className="text-[17px] font-semibold mb-2">Start Building Intelligence</p>
                  <p className="text-[13px] text-muted-foreground mb-7 max-w-[320px] mx-auto leading-relaxed">
                    Upload documents from any channel and let our 10 AI agents extract, analyze, and generate your BRD automatically.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => navigate("/projects/new")}
                      className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-[13px] font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5"
                    >
                      <Plus className="w-4 h-4 inline mr-1.5 -mt-px" />
                      Create Project
                    </button>
                    <button
                      onClick={async () => {
                        setSeeding(true);
                        try {
                          await seedDemo();
                        } finally {
                          setSeeding(false);
                        }
                      }}
                      disabled={seeding}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-[13px] font-medium hover:opacity-90 transition-all shadow-md shadow-violet-600/20 disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <Rocket className="w-4 h-4 inline mr-1.5 -mt-px" />
                      {seeding ? "Seeding..." : "Load Demo Project"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {projects.slice(0, 5).map((project: any) => {
                  const status = statusStyles[project.status] || statusStyles.draft;
                  return (
                    <div
                      key={project._id}
                      onClick={() => navigate(`/projects/${project._id}`)}
                      className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-accent/40 transition-colors group"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 ring-4 ring-background"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[14px] font-medium truncate group-hover:text-primary transition-colors">
                            {project.name}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                          {project.description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1"><Database className="w-3 h-3" />{project.sourceCount}</span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{project.requirementCount}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{project.stakeholderCount}</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Pipeline Runs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/15 to-primary/15 flex items-center justify-center shadow-sm">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-[14px] font-medium">Pipeline Runs</h3>
              </div>
            </div>

            {!recentRuns || recentRuns.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Play className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">No pipeline runs yet</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Start a pipeline from a project workspace
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentRuns.slice(0, 5).map((run: any) => (
                  <div
                    key={run._id}
                    className="px-5 py-3.5"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          run.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : run.status === "failed"
                              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                        }`}
                      >
                        {run.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(run.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{run.requirementsFound} reqs</span>
                      <span className="text-border">&middot;</span>
                      <span>{run.stakeholdersFound} stakeholders</span>
                      <span className="text-border">&middot;</span>
                      <span>{run.conflictsFound} conflicts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card backdrop-blur-sm rounded-2xl border border-border/60 p-5 shadow-sm"
          >
            <h3 className="text-[14px] font-medium mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Manage Integrations", icon: Puzzle, path: "/integrations", desc: "Connect GitHub, Slack, Jira, and data sources" },
                { label: "New Project", icon: Plus, path: "/projects/new", desc: "Create and start extracting requirements" },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left hover:bg-accent/50 transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
