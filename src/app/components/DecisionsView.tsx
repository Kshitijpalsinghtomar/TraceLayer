/**
 * DecisionsView — Displays all extracted decisions for a project
 * with decision type breakdown, status tracking, and impact analysis.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  GitBranch,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Zap,
  FileText,
  Users,
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
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  architectural: "#6B7AE8",
  functional: "#3B82F6",
  business: "#F97316",
  technical: "#06B6D4",
  process: "#22C55E",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  proposed: { label: "Proposed", icon: Clock, className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-50 text-red-700" },
  deferred: { label: "Deferred", icon: AlertTriangle, className: "bg-muted text-muted-foreground" },
};

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

export function DecisionsView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = projectId as Id<"projects"> | undefined;

  const project = useQuery(api.projects.get, pid ? { projectId: pid } : "skip");
  const decisions = useQuery(api.decisions.listByProject, pid ? { projectId: pid } : "skip");
  const stakeholders = useQuery(api.stakeholders.listByProject, pid ? { projectId: pid } : "skip");

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const decs = decisions || [];
  const stks = stakeholders || [];

  // Charts data
  const typeData = Object.entries(
    decs.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: TYPE_COLORS[name] || "#94A3B8",
  }));

  const statusData = Object.entries(
    decs.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  }));

  const avgConfidence = decs.length > 0 ? decs.reduce((s, d) => s + d.confidenceScore, 0) / decs.length : 0;

  return (
    <div className="px-10 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to project
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-[22px] tracking-[-0.02em]">Decisions</h1>
            <p className="text-muted-foreground text-[13px]">
              {project.name} — {decs.length} decisions extracted
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-3 mb-6"
      >
        {[
          { label: "Total Decisions", value: decs.length, color: "#8B5CF6" },
          { label: "Approved", value: decs.filter((d) => d.status === "approved").length, color: "#22C55E" },
          { label: "Pending", value: decs.filter((d) => d.status === "proposed").length, color: "#F59E0B" },
          { label: "Avg Confidence", value: `${Math.round(avgConfidence * 100)}%`, color: "#06B6D4" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <p className="text-[11px] text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Decision Types</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine
                >
                  {typeData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              No decisions yet
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Decision Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Decisions" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              No decisions yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Decision Cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-[16px] font-medium mb-4">All Decisions</h2>
        {decs.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <GitBranch className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No decisions extracted yet. Run the pipeline first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {decs.map((dec) => {
              const statusCfg = STATUS_CONFIG[dec.status] || STATUS_CONFIG.proposed;
              const StatusIcon = statusCfg.icon;
              return (
                <div key={dec._id} className="bg-card rounded-2xl border border-border p-6 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[12px] font-mono text-muted-foreground">{dec.decisionId}</span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                        style={{
                          backgroundColor: (TYPE_COLORS[dec.type] || "#94A3B8") + "15",
                          color: TYPE_COLORS[dec.type] || "#94A3B8",
                        }}
                      >
                        {dec.type}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        dec.confidenceScore >= 0.8
                          ? "bg-emerald-50 text-emerald-700"
                          : dec.confidenceScore >= 0.5
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {Math.round(dec.confidenceScore * 100)}% confidence
                    </span>
                  </div>
                  <h4 className="text-[15px] mb-2">{dec.title}</h4>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{dec.description}</p>
                  {dec.sourceExcerpt && (
                    <div className="bg-background rounded-lg border border-border p-3">
                      <p className="text-[12px] text-muted-foreground italic border-l-2 border-primary/20 pl-3">
                        &ldquo;{dec.sourceExcerpt}&rdquo;
                      </p>
                    </div>
                  )}
                  {dec.impactedRequirementIds.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Zap className="w-3 h-3" />
                      Impacts {dec.impactedRequirementIds.length} requirement{dec.impactedRequirementIds.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
