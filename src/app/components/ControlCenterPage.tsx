/**
 * ControlCenterPage — Full-page wrapper for PipelineControlCenter.
 * Accessible at /projects/:projectId/controls
 */
import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { motion } from "motion/react";
import { Loader2, XCircle, SlidersHorizontal, ArrowLeft, Terminal, FileText, Network, BarChart3 } from "lucide-react";
import { PipelineControlCenter } from "./PipelineControlCenter";

export function ControlCenterPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

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

  return (
    <div className="px-10 py-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <SlidersHorizontal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Control Center</h1>
              <p className="text-muted-foreground text-[14px] mt-0.5">
                {project.name} — Pipeline Controls, Diagnostics, Testing & Data Management
              </p>
            </div>
          </div>

          {/* Quick nav buttons */}
          <div className="flex items-center gap-2">
            {[
              { label: "Workspace", icon: ArrowLeft, path: `/projects/${projectId}` },
              { label: "Pipeline Logs", icon: Terminal, path: `/projects/${projectId}/pipeline` },
              { label: "BRD", icon: FileText, path: `/projects/${projectId}/brd` },
              { label: "Graph", icon: Network, path: `/projects/${projectId}/graph` },
              { label: "Analytics", icon: BarChart3, path: `/projects/${projectId}/analytics` },
            ].map((nav) => (
              <button
                key={nav.label}
                onClick={() => navigate(nav.path)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-all border border-border/50 hover:border-border"
              >
                <nav.icon className="w-3.5 h-3.5" />
                {nav.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Full-width Control Center */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
        style={{ minHeight: "calc(100vh - 220px)" }}
      >
        <PipelineControlCenter projectId={projectId} />
      </motion.div>
    </div>
  );
}
