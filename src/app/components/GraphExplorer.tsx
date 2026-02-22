/**
 * GraphExplorer — Full page knowledge graph exploration view
 * Wraps the KnowledgeGraph component with additional controls and data panels
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Network,
  FileText,
  Users,
  GitBranch,
  AlertTriangle,
  Database,
  TrendingUp,
  BarChart3,
  PieChartIcon,
  Activity,
} from "lucide-react";
import { KnowledgeGraph } from "./KnowledgeGraph";
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
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  functional: "#6366F1",
  non_functional: "#10B981",
  business: "#F97316",
  technical: "#06B6D4",
  security: "#EF4444",
  performance: "#22C55E",
  compliance: "#64748B",
  integration: "#EC4899",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  high: "#F97316",
  medium: "#EAB308",
  low: "#3B82F6",
};

const INFLUENCE_COLORS: Record<string, string> = {
  decision_maker: "#EF4444",
  influencer: "#F97316",
  contributor: "#3B82F6",
  observer: "#94A3B8",
};

function GraphTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/98 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-xl text-[12px]">
      {label && <p className="font-semibold mb-1.5 text-foreground">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.fill }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function GraphExplorer() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const requirements = useQuery(
    api.requirements.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const stakeholders = useQuery(
    api.stakeholders.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const decisions = useQuery(
    api.decisions.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const conflicts = useQuery(
    api.conflicts.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const sources = useQuery(
    api.sources.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  if (!projectId) return null;

  // Category distribution for requirements
  const categoryDist = (requirements || []).reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityDist = (requirements || []).reduce((acc, r) => {
    acc[r.priority] = (acc[r.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgConfidence =
    requirements && requirements.length > 0
      ? requirements.reduce((sum, r) => sum + r.confidenceScore, 0) / requirements.length
      : 0;

  const stats = [
    { icon: FileText, label: "Requirements", value: requirements?.length || 0, color: "#6366F1", bg: "from-indigo-500/10 to-indigo-500/5" },
    { icon: Users, label: "Stakeholders", value: stakeholders?.length || 0, color: "#10B981", bg: "from-emerald-500/10 to-emerald-500/5" },
    { icon: Database, label: "Sources", value: sources?.length || 0, color: "#F59E0B", bg: "from-amber-500/10 to-amber-500/5" },
    { icon: GitBranch, label: "Decisions", value: decisions?.length || 0, color: "#8B5CF6", bg: "from-violet-500/10 to-violet-500/5" },
    { icon: AlertTriangle, label: "Conflicts", value: conflicts?.length || 0, color: "#EF4444", bg: "from-red-500/10 to-red-500/5" },
    { icon: TrendingUp, label: "Avg Confidence", value: `${(avgConfidence * 100).toFixed(0)}%`, color: "#06B6D4", bg: "from-cyan-500/10 to-cyan-500/5" },
  ];

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to project
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Knowledge Graph</h1>
            <p className="text-muted-foreground text-[14px] mt-0.5">
              {project?.name} — Requirements Intelligence Visualization
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-6 gap-3 mb-8"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
            className={`relative bg-gradient-to-br ${stat.bg} rounded-2xl border border-border/40 p-4 overflow-hidden group hover:shadow-md transition-shadow duration-300`}
          >
            {/* Subtle accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60" style={{ backgroundColor: stat.color }} />
            <stat.icon className="w-4 h-4 mb-2.5" style={{ color: stat.color }} />
            <p className="text-[22px] font-bold tracking-[-0.02em]">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Graph */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <KnowledgeGraph projectId={projectId as Id<"projects">} />
      </motion.div>

      {/* Analytics Panels */}
      <div className="grid grid-cols-3 gap-6">
        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
        >
          <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <PieChartIcon className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Categories</h3>
              <p className="text-[11px] text-muted-foreground">Requirement distribution</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            {Object.keys(categoryDist).length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(categoryDist).map(([cat, count]) => ({
                        name: cat.replace(/_/g, " "),
                        value: count,
                        fill: CATEGORY_COLORS[cat] || "#94A3B8",
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {Object.entries(categoryDist).map(([cat], i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[cat] || "#94A3B8"} />
                      ))}
                    </Pie>
                    <Tooltip content={<GraphTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Mini legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                  {Object.entries(categoryDist).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || "#94A3B8" }} />
                      <span className="text-muted-foreground capitalize">{cat.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <PieChartIcon className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-muted-foreground text-[12px]">No data yet</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Priority Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
        >
          <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Priority Levels</h3>
              <p className="text-[11px] text-muted-foreground">By requirement priority</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            {requirements && requirements.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={(["critical", "high", "medium", "low"] as const).map((p) => ({
                    name: p.charAt(0).toUpperCase() + p.slice(1),
                    count: priorityDist[p] || 0,
                    fill: PRIORITY_COLORS[p],
                  }))}
                  barSize={32}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<GraphTooltip />} />
                  <Bar dataKey="count" name="Requirements" radius={[8, 8, 0, 0]}>
                    {(["critical", "high", "medium", "low"] as const).map((p, i) => (
                      <Cell key={i} fill={PRIORITY_COLORS[p]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-muted-foreground text-[12px]">No data yet</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stakeholder Influence */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
        >
          <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Stakeholder Influence</h3>
              <p className="text-[11px] text-muted-foreground">Role distribution</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            {stakeholders && stakeholders.length > 0 ? (() => {
              const influenceData = Object.entries(
                stakeholders.reduce((acc, s) => {
                  acc[s.influence] = (acc[s.influence] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([name, value]) => ({
                name: name.replace(/_/g, " "),
                value,
                fill: INFLUENCE_COLORS[name] || "#94A3B8",
              }));
              return (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={influenceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {influenceData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<GraphTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Mini legend */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                    {influenceData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="text-muted-foreground capitalize">{item.name}</span>
                        <span className="font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })() : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-muted-foreground text-[12px]">No stakeholder data</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
