/**
 * SmartInsights — AI-Generated Intelligence Cards
 *
 * Displays proactive insights computed from live project data.
 * Shows quality scores, risk alerts, coverage gaps, and achievements
 * with animated progress rings and severity-based styling.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  CheckCircle,
  LayoutGrid,
  Shield,
  UserX,
  Gauge,
  GitBranch,
  Layers,
  MessageSquare,
  Rocket,
  Upload,
  Play,
  AlertOctagon,
  BarChart3,
  FileText,
  Brain,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Icon Mapping ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Activity, ShieldAlert, CheckCircle2, AlertTriangle, CheckCircle,
  LayoutGrid, Shield, UserX, Gauge, GitBranch, Layers, MessageSquare,
  Rocket, Upload, Play, AlertOctagon, BarChart3, FileText, Brain, Sparkles,
};

// ─── Severity Styles ──────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  critical: {
    bg: "from-red-500/10 to-red-600/5",
    border: "border-red-500/30",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
    ring: "#EF4444",
    glow: "shadow-red-500/10",
  },
  warning: {
    bg: "from-amber-500/10 to-amber-600/5",
    border: "border-amber-500/30",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "#F59E0B",
    glow: "shadow-amber-500/10",
  },
  info: {
    bg: "from-blue-500/10 to-blue-600/5",
    border: "border-blue-500/30",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    ring: "#3B82F6",
    glow: "shadow-blue-500/10",
  },
  success: {
    bg: "from-emerald-500/10 to-emerald-600/5",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "#22C55E",
    glow: "shadow-emerald-500/10",
  },
} as const;

// ─── Circular Progress Ring ───────────────────────────────────────────────────
function ProgressRing({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <span className="absolute text-[11px] font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// ─── Single Insight Card ──────────────────────────────────────────────────────
function InsightCard({ insight, index }: { insight: any; index: number }) {
  const style = SEVERITY_STYLES[insight.severity as keyof typeof SEVERITY_STYLES];
  const Icon = ICON_MAP[insight.icon] || Activity;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className={`group relative rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-4 backdrop-blur-sm hover:shadow-lg ${style.glow} transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <div className={`w-9 h-9 rounded-xl ${style.badge} flex items-center justify-center`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[13px] font-semibold text-foreground leading-tight truncate">
              {insight.title}
            </h4>
            <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style.badge}`}>
              {insight.category}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
            {insight.description}
          </p>
        </div>

        {/* Metric Ring */}
        {insight.metric !== undefined && (
          <div className="shrink-0">
            <ProgressRing value={insight.metric} color={style.ring} />
          </div>
        )}
      </div>

      {/* Subtle bottom gradient accent */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${style.ring}40, transparent)` }}
      />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SmartInsights() {
  const insights = useQuery(api.insights.getDashboardInsights);

  if (!insights || insights.length === 0) return null;

  // Sort: critical first, then warning, then info, then success
  const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
  const sorted = [...insights].sort(
    (a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
              (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
  );

  // Limit to top 6 most important
  const displayed = sorted.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            AI Insights
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          </h3>
          <p className="text-[11px] text-muted-foreground">Proactive intelligence from your data</p>
        </div>
        <motion.div
          className="ml-auto flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <TrendingUp className="w-3 h-3" />
          <span className="font-medium">{insights.length} signals</span>
        </motion.div>
      </div>

      {/* Insight Cards Grid */}
      <AnimatePresence mode="wait">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayed.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
