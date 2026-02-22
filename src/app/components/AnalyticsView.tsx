/**
 * AnalyticsView — Project-level analytics dashboard with recharts visualizations
 * Shows requirement distribution, stakeholder influence, confidence scoring, and more.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  ArrowLeft,
  FileText,
  Users,
  AlertTriangle,
  GitBranch,
  Zap,
  Target,
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
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from "recharts";

// ─── Colors ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  functional: "#6B7AE8",
  non_functional: "#66BB8C",
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

const STATUS_COLORS: Record<string, string> = {
  discovered: "#3B82F6",
  pending: "#F59E0B",
  under_review: "#8B5CF6",
  confirmed: "#22C55E",
  rejected: "#EF4444",
  deferred: "#94A3B8",
};

const INFLUENCE_COLORS: Record<string, string> = {
  decision_maker: "#EF4444",
  influencer: "#F97316",
  contributor: "#3B82F6",
  observer: "#94A3B8",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  major: "#F97316",
  minor: "#EAB308",
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-[12px]">
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

// ─── Main Component ─────────────────────────────────────────────────────────

export function AnalyticsView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = projectId as Id<"projects"> | undefined;

  const project = useQuery(api.projects.get, pid ? { projectId: pid } : "skip");
  const requirements = useQuery(api.requirements.listByProject, pid ? { projectId: pid } : "skip");
  const stakeholders = useQuery(api.stakeholders.listByProject, pid ? { projectId: pid } : "skip");
  const decisions = useQuery(api.decisions.listByProject, pid ? { projectId: pid } : "skip");
  const conflicts = useQuery(api.conflicts.listByProject, pid ? { projectId: pid } : "skip");
  const sources = useQuery(api.sources.listByProject, pid ? { projectId: pid } : "skip");

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const reqs = requirements || [];
  const stks = stakeholders || [];
  const decs = decisions || [];
  const confs = conflicts || [];
  const srcs = sources || [];

  // ─── Data Transforms ───────────────────────────────────────────────────

  // Category distribution (Pie)
  const categoryData = Object.entries(
    reqs.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: CATEGORY_COLORS[name] || "#94A3B8",
  }));

  // Priority distribution (Bar)
  const priorityData = ["critical", "high", "medium", "low"].map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    count: reqs.filter((r) => r.priority === p).length,
    fill: PRIORITY_COLORS[p],
  }));

  // Status distribution (Pie)
  const statusData = Object.entries(
    reqs.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: STATUS_COLORS[name] || "#94A3B8",
  }));

  // Confidence distribution (Bar)
  const confidenceBuckets = [
    { range: "90-100%", min: 0.9, max: 1.01 },
    { range: "80-89%", min: 0.8, max: 0.9 },
    { range: "70-79%", min: 0.7, max: 0.8 },
    { range: "60-69%", min: 0.6, max: 0.7 },
    { range: "<60%", min: 0, max: 0.6 },
  ];
  const confidenceData = confidenceBuckets.map((b) => ({
    name: b.range,
    count: reqs.filter((r) => r.confidenceScore >= b.min && r.confidenceScore < b.max).length,
  }));

  // Stakeholder influence (Pie)
  const influenceData = Object.entries(
    stks.reduce((acc, s) => {
      acc[s.influence] = (acc[s.influence] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: INFLUENCE_COLORS[name] || "#94A3B8",
  }));

  // Conflict severity (Pie)
  const conflictData = Object.entries(
    confs.reduce((acc, c) => {
      acc[c.severity] = (acc[c.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: SEVERITY_COLORS[name] || "#94A3B8",
  }));

  // Decision types (Bar)
  const decisionTypeData = Object.entries(
    decs.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  }));

  // Radar chart — project health
  const avgConfidence = reqs.length > 0 ? reqs.reduce((s, r) => s + r.confidenceScore, 0) / reqs.length : 0;
  const radarData = [
    { metric: "Requirements", value: Math.min(reqs.length * 10, 100), fullMark: 100 },
    { metric: "Stakeholders", value: Math.min(stks.length * 20, 100), fullMark: 100 },
    { metric: "Confidence", value: Math.round(avgConfidence * 100), fullMark: 100 },
    { metric: "Coverage", value: Math.min(srcs.length * 25, 100), fullMark: 100 },
    { metric: "Decisions", value: Math.min(decs.length * 15, 100), fullMark: 100 },
    { metric: "Conflicts Resolved", value: confs.length > 0 ? Math.round((confs.filter((c) => c.status === "resolved").length / confs.length) * 100) : 100, fullMark: 100 },
  ];

  // Source type distribution
  const sourceTypeData = Object.entries(
    srcs.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: name === "email" ? "#E8A838" : name === "meeting_transcript" ? "#8B5CF6" : name === "chat_log" ? "#66BB8C" : name === "document" ? "#3B82F6" : "#64748B",
  }));

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to project
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[22px] tracking-[-0.02em]">Project Analytics</h1>
            <p className="text-muted-foreground text-[13px]">{project.name} — Data visualizations &amp; insights</p>
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
        {[
          { icon: FileText, label: "Requirements", value: reqs.length, color: "#6B7AE8" },
          { icon: Users, label: "Stakeholders", value: stks.length, color: "#66BB8C" },
          { icon: GitBranch, label: "Decisions", value: decs.length, color: "#8B5CF6" },
          { icon: AlertTriangle, label: "Conflicts", value: confs.length, color: "#EF4444" },
          { icon: Target, label: "Avg Confidence", value: `${Math.round(avgConfidence * 100)}%`, color: "#06B6D4" },
          { icon: Zap, label: "Sources", value: srcs.length, color: "#E8A838" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-[22px] font-semibold tracking-[-0.02em]">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Row 1: Category Pie + Priority Bar */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Requirement Categories
          </h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-[12px] capitalize">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No requirements data yet
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Priority Distribution
          </h3>
          {reqs.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Requirements" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No requirements data yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 2: Confidence Distribution + Status Pie */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Confidence Score Distribution
          </h3>
          {reqs.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={confidenceData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Requirements" fill="#6B7AE8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No data
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Requirement Status
          </h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-[12px] capitalize">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No data
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 3: Radar Health + Stakeholder Influence + Source Types */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Project Health Radar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Health" dataKey="value" stroke="#6B7AE8" fill="#6B7AE8" fillOpacity={0.25} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Stakeholder Influence</h3>
          {influenceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={influenceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {influenceData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-[12px] capitalize">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No stakeholder data
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Source Types</h3>
          {sourceTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sourceTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine
                >
                  {sourceTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No source data
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 4: Conflicts + Decision Types */}
      <div className="grid grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Conflict Severity
          </h3>
          {conflictData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={conflictData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {conflictData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-[12px]">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No conflicts detected
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-500" />
            Decision Types
          </h3>
          {decisionTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={decisionTypeData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Decisions" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No decisions data
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
