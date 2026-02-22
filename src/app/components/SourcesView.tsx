/**
 * SourcesView — Dedicated page for viewing all uploaded sources for a project.
 * Shows source type distribution, status breakdown, and detailed list.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Database,
  FileText,
  Mail,
  MessageSquare,
  Mic,
  File,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
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

const TYPE_ICONS: Record<string, typeof FileText> = {
  email: Mail,
  meeting_transcript: Mic,
  chat_log: MessageSquare,
  document: FileText,
  uploaded_file: File,
};

const TYPE_COLORS: Record<string, string> = {
  email: "#E8A838",
  meeting_transcript: "#8B5CF6",
  chat_log: "#66BB8C",
  document: "#3B82F6",
  uploaded_file: "#64748B",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Uploaded", className: "bg-muted text-muted-foreground" },
  classifying: { label: "Classifying", className: "bg-blue-50 text-blue-700" },
  classified: { label: "Classified", className: "bg-blue-50 text-blue-700" },
  extracting: { label: "Extracting", className: "bg-purple-50 text-purple-700" },
  extracted: { label: "Extracted", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700" },
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

export function SourcesView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = projectId as Id<"projects"> | undefined;

  const project = useQuery(api.projects.get, pid ? { projectId: pid } : "skip");
  const sources = useQuery(api.sources.listByProject, pid ? { projectId: pid } : "skip");

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const srcs = sources || [];

  // Source type distribution
  const typeData = Object.entries(
    srcs.reduce((acc, s) => {
      const label = s.type.replace(/_/g, " ");
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name,
    value,
    fill: TYPE_COLORS[name.replace(/ /g, "_")] || "#64748B",
  }));

  // Status distribution
  const statusData = Object.entries(
    srcs.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  }));

  const totalWords = srcs.reduce((sum, s) => sum + (s.metadata?.wordCount || 0), 0);
  const extractedCount = srcs.filter((s) => s.status === "extracted").length;

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
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-[22px] tracking-[-0.02em]">Sources</h1>
            <p className="text-muted-foreground text-[13px]">
              {project.name} — {srcs.length} communication sources
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
          { label: "Total Sources", value: srcs.length, color: "#E8A838" },
          { label: "Extracted", value: extractedCount, color: "#22C55E" },
          { label: "Total Words", value: totalWords.toLocaleString(), color: "#3B82F6" },
          { label: "Source Types", value: Object.keys(typeData).length, color: "#8B5CF6" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <p className="text-[11px] text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Source Types</h3>
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
              No sources yet
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <h3 className="text-[15px] font-medium mb-4">Processing Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Sources" fill="#E8A838" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              No sources yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Source List */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-[16px] font-medium mb-4">All Sources</h2>
        {srcs.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No sources uploaded yet.</p>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Go to workspace to upload files
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {srcs.map((source) => {
              const Icon = TYPE_ICONS[source.type] || File;
              const color = TYPE_COLORS[source.type] || "#64748B";
              const status = STATUS_CONFIG[source.status] || STATUS_CONFIG.uploaded;
              return (
                <div
                  key={source._id}
                  className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + "15" }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">{source.name}</p>
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{source.type.replace(/_/g, " ")}</span>
                      {source.metadata?.wordCount != null && (
                        <>
                          <span>·</span>
                          <span>{source.metadata.wordCount.toLocaleString()} words</span>
                        </>
                      )}
                      {source.metadata?.date && (
                        <>
                          <span>·</span>
                          <span>{new Date(source.metadata.date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {source.relevanceScore != null && (
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round(source.relevanceScore * 100)}% relevant
                      </span>
                    )}
                    <span className={`text-[11px] px-2.5 py-1 rounded-full ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
