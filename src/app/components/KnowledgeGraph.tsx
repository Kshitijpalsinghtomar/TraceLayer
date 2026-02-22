import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import {
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  Link2,
  Layers,
  X,
  Info,
} from "lucide-react";

interface KnowledgeGraphProps {
  projectId: Id<"projects">;
}

const NODE_COLORS: Record<string, string> = {
  requirement: "#6366F1",
  stakeholder: "#10B981",
  source: "#F59E0B",
  decision: "#8B5CF6",
  conflict: "#EF4444",
  timeline: "#06B6D4",
};

const NODE_LABELS: Record<string, string> = {
  requirement: "Requirement",
  stakeholder: "Stakeholder",
  source: "Source",
  decision: "Decision",
  conflict: "Conflict",
  timeline: "Timeline",
};

const FILTER_LABELS: Record<string, string> = {
  requirement: "Requirements",
  stakeholder: "Stakeholders",
  source: "Sources",
  decision: "Decisions",
  conflict: "Conflicts",
};

const NODE_RADII: Record<string, number> = {
  requirement: 6,
  stakeholder: 8,
  source: 5,
  decision: 7,
  conflict: 9,
  timeline: 6,
};

const LINK_COLORS: Record<string, string> = {
  defines: "rgba(245,158,11,0.35)",
  involves: "rgba(16,185,129,0.35)",
  affects: "rgba(139,92,246,0.35)",
  blocks: "rgba(239,68,68,0.45)",
  references: "rgba(148,163,184,0.25)",
  default: "rgba(148,163,184,0.22)",
};

export function KnowledgeGraph({ projectId }: KnowledgeGraphProps) {
  const graphData = useQuery(api.traceability.getProjectGraph, { projectId });
  const [filter, setFilter] = useState<string>("all");
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<any, any>>(undefined);

  // Track whether graph data is available (controls which JSX branch renders)
  const hasGraphData = graphData && graphData.nodes.length > 0;

  // Resize observer — re-runs when hasGraphData flips so the containerRef is attached
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const updateDimensions = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    // RAF ensures the browser has applied CSS layout before we measure
    const raf = requestAnimationFrame(updateDimensions);
    window.addEventListener('resize', updateDimensions);

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateDimensions);
      observer.disconnect();
    };
  }, [hasGraphData]);

  const typeCounts = useMemo(() => {
    if (!graphData) return {};
    const counts: Record<string, number> = {};
    graphData.nodes.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  const forceGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const nodes = graphData.nodes.map(n => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Use explicit traceability edges when available
    let links: any[] = graphData.edges
      .filter((e) => nodeIds.has(e.source as any) && nodeIds.has(e.target as any))
      .map((e) => ({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        strength: e.strength ?? 0.5,
      }));

    // Auto-generate balanced edges when no explicit links exist
    if (links.length === 0) {
      const reqs = nodes.filter((n) => n.type === "requirement");
      const stakeholders = nodes.filter((n) => n.type === "stakeholder");
      const sources = nodes.filter((n) => n.type === "source");
      const decisions = nodes.filter((n) => n.type === "decision");
      const conflicts = nodes.filter((n) => n.type === "conflict");

      const added = new Set<string>();
      const addLink = (s: string, t: string, rel: string, str: number) => {
        const key = `${s}→${t}`;
        if (!added.has(key) && s !== t) {
          added.add(key);
          links.push({ source: s, target: t, relationship: rel, strength: str });
        }
      };

      // Track per-node degree to avoid collapsing hubs (max 6 edges per node)
      const degree: Record<string, number> = {};
      const canAdd = (id: string) => (degree[id] || 0) < 6;
      const addBalanced = (s: string, t: string, rel: string, str: number, force = false) => {
        if (force || (canAdd(s) && canAdd(t))) {
          addLink(s, t, rel, str);
          degree[s] = (degree[s] || 0) + 1;
          degree[t] = (degree[t] || 0) + 1;
        }
      };

      // Sources → requirements (spread evenly, limited fan-out)
      const reqsPerSource = Math.min(6, Math.ceil(reqs.length / Math.max(1, sources.length)));
      sources.forEach((src, si) => {
        const start = si * reqsPerSource;
        reqs.slice(start, start + reqsPerSource).forEach((req, idx) =>
          addBalanced(src.id, req.id, "defines", 0.6, idx === 0)
        );
      });

      // Requirements → stakeholders (spread evenly, not round-robin to all)
      reqs.forEach((req, i) => {
        if (stakeholders.length > 0) {
          addBalanced(req.id, stakeholders[i % stakeholders.length].id, "involves", 0.5, true);
        }
      });

      // Decisions → requirements (each decision → 2 reqs max, spread)
      decisions.forEach((dec, i) => {
        const baseIdx = (i * 2) % Math.max(1, reqs.length);
        addBalanced(dec.id, reqs[baseIdx].id, "affects", 0.7, true);
        if (reqs.length > 1) {
          addBalanced(dec.id, reqs[(baseIdx + 1) % reqs.length].id, "affects", 0.4);
        }
      });

      // Conflicts → closest decision or requirement
      conflicts.forEach((con, i) => {
        if (decisions.length > 0) {
          addBalanced(con.id, decisions[i % decisions.length].id, "blocks", 0.85, true);
          // Also link conflict to a second decision or a req so it's not isolated
          if (decisions.length > 1) {
            addBalanced(con.id, decisions[(i + 1) % decisions.length].id, "blocks", 0.6);
          } else if (reqs.length > 0) {
            addBalanced(con.id, reqs[i % reqs.length].id, "blocks", 0.6);
          }
        } else if (reqs.length > 0) {
          addBalanced(con.id, reqs[i % reqs.length].id, "blocks", 0.85, true);
          if (reqs.length > 1) {
            addBalanced(con.id, reqs[(i + 1) % reqs.length].id, "blocks", 0.6);
          }
        }
      });
    }

    // Pre-position nodes by type so D3 starts from a spread layout
    const TYPE_ANGLES: Record<string, number> = {
      requirement: 0,
      stakeholder: Math.PI * 0.5,
      source: Math.PI,
      decision: Math.PI * 1.3,
      conflict: Math.PI * 1.7,
      timeline: Math.PI * 0.9,
    };
    const TYPE_RADIUS: Record<string, number> = {
      requirement: 220,
      stakeholder: 140,
      source: 90,
      decision: 180,
      conflict: 120,
      timeline: 160,
    };
    const typeCounters: Record<string, number> = {};

    const positionedNodes = nodes.map((n) => {
      const idx = typeCounters[n.type] || 0;
      typeCounters[n.type] = idx + 1;
      const total = nodes.filter((x) => x.type === n.type).length;
      const baseAngle = TYPE_ANGLES[n.type] ?? 0;
      const spread = total > 1 ? (Math.PI * 0.6) / total : 0;
      const angle = baseAngle + (idx - (total - 1) / 2) * spread;
      const radius = TYPE_RADIUS[n.type] ?? 180;
      return {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });

    return { nodes: positionedNodes, links };
  }, [graphData]);

  const displayData = useMemo(() => {
    if (filter === "all") return forceGraphData;
    
    const filteredNodes = forceGraphData.nodes.filter(n => n.type === filter);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = forceGraphData.links.filter(l => 
      nodeIds.has(l.source.id || l.source) && nodeIds.has(l.target.id || l.target)
    );
    
    return { nodes: filteredNodes, links: filteredLinks };
  }, [forceGraphData, filter]);

  const zoomIn = useCallback(() => {
    const next = Math.min(zoomLevel * 1.4, 12);
    setZoomLevel(next);
    fgRef.current?.zoom(next, 280);
  }, [zoomLevel]);

  const zoomOut = useCallback(() => {
    const next = Math.max(zoomLevel / 1.4, 0.1);
    setZoomLevel(next);
    fgRef.current?.zoom(next, 280);
  }, [zoomLevel]);

  const fitView = useCallback(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, []);

  // Configure D3 forces for a readable, spread-out layout
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // Strong mutual repulsion so nodes push each other apart
    (fg.d3Force("charge") as any)?.strength(-400);
    // Link rest-length so connected nodes aren't too close or too far
    (fg.d3Force("link") as any)?.distance((link: any) => {
      const rel = link.relationship;
      if (rel === "blocks") return 120;
      if (rel === "defines") return 100;
      if (rel === "involves") return 130;
      return 90;
    }).strength(0.5);
    // Weak center gravity to keep the graph on screen
    (fg.d3Force("center") as any)?.strength(0.08);

    // Custom bounding box force to prevent nodes from flying away
    const boxForce = function(alpha: number) {
      const nodes = (boxForce as any).nodes;
      if (!nodes) return;
      const r = 400; // max radius
      nodes.forEach((node: any) => {
        const dist = Math.sqrt(node.x * node.x + node.y * node.y);
        if (dist > r) {
          const pull = (dist - r) * 0.05 * alpha;
          node.vx -= (node.x / dist) * pull;
          node.vy -= (node.y / dist) * pull;
        }
      });
    };
    boxForce.initialize = function(nodes: any) {
      (boxForce as any).nodes = nodes;
    };
    fg.d3Force("box", boxForce);
  }, [forceGraphData]);

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-card rounded-2xl border border-border/50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Loading Knowledge Graph</p>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-card rounded-2xl border border-border/50">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No Intelligence Data</p>
          <p className="text-xs text-muted-foreground">Run the extraction pipeline to populate the knowledge graph.</p>
        </div>
      </div>
    );
  }

  const autoEdges = graphData.edges.length === 0;

  return (
    <div ref={containerRef} className="relative bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm w-full h-[660px]">

      {/* ── Filter Bar ── */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-background/95 backdrop-blur-md rounded-xl border border-border/50 shadow-sm p-1 flex items-center gap-1">
          <div className="px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          {["all", "requirement", "stakeholder", "source", "decision", "conflict"].map((f) => {
            const isActive = filter === f;
            const count = f === "all" ? forceGraphData.nodes.length : (typeCounts[f] || 0);
            if (f !== "all" && count === 0) return null;
            const color = NODE_COLORS[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 flex items-center gap-1.5"
                style={
                  isActive
                    ? { backgroundColor: f === "all" ? "#6366F1" : color, color: "#fff" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {f === "all" ? "All" : FILTER_LABELS[f]}
                <span className={isActive ? "text-white/70 text-[10px]" : "text-[10px] text-muted-foreground"}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Zoom Controls ── */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn, action: zoomIn, label: "Zoom in" },
          { icon: ZoomOut, action: zoomOut, label: "Zoom out" },
          { icon: Maximize2, action: fitView, label: "Fit view" },
        ].map(({ icon: Icon, action, label }) => (
          <button
            key={label}
            onClick={action}
            title={label}
            className="bg-background/95 backdrop-blur-md rounded-xl border border-border/50 shadow-sm p-2.5 hover:bg-muted transition-colors group"
          >
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-background/95 backdrop-blur-md rounded-xl border border-border/50 shadow-sm px-4 py-3">
          <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Legend</p>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
            {Object.entries(NODE_COLORS)
              .filter(([type]) => typeCounts[type])
              .map(([type, color]) => (
                <button
                  key={type}
                  onClick={() => setFilter(filter === type ? "all" : type)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-muted-foreground capitalize font-medium">{NODE_LABELS[type]}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ── Stats Badge ── */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3">
        {autoEdges && (
          <div className="bg-amber-50 border border-amber-200/60 text-amber-700 rounded-full px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            Inferred connections
          </div>
        )}
        <div className="bg-background/95 backdrop-blur-md rounded-full border border-border/50 shadow-sm px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">{displayData.nodes.length}</span>
            <span className="text-muted-foreground">nodes</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5 text-[11px]">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">{displayData.links.length}</span>
            <span className="text-muted-foreground">edges</span>
          </div>
        </div>
      </div>

      {/* ── Node Detail Panel ── */}
      {selectedNode && (
        <div className="absolute top-16 right-4 z-20 w-64 bg-background/98 backdrop-blur-xl rounded-2xl border border-border/60 shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || "#94A3B8" }} />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {NODE_LABELS[selectedNode.type]}
              </span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[13px] font-semibold text-foreground leading-tight mb-3">{selectedNode.label}</p>
          <div className="space-y-2">
            {selectedNode.category && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium text-foreground capitalize">{selectedNode.category}</span>
              </div>
            )}
            {selectedNode.priority && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-medium text-foreground capitalize">{selectedNode.priority}</span>
              </div>
            )}
            {selectedNode.confidence != null && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium text-foreground">{Math.round(selectedNode.confidence * 100)}%</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Connections</span>
              <span className="font-medium text-foreground">
                {displayData.links.filter((l: any) => l.source?.id === selectedNode.id || l.target?.id === selectedNode.id || l.source === selectedNode.id || l.target === selectedNode.id).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Force Graph ── */}
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={displayData}
        nodeLabel=""
        nodeColor={(node: any) => NODE_COLORS[node.type] || "#94A3B8"}
        nodeVal={(node: any) => NODE_RADII[node.type] || 5}
        linkColor={(link: any) => LINK_COLORS[link.relationship] || LINK_COLORS.default}
        linkWidth={(link: any) => Math.max(0.8, (link.strength || 0.5) * 2)}
        linkDirectionalArrowLength={(link: any) => link.relationship === "blocks" ? 4 : 0}
        linkDirectionalArrowRelPos={0.85}
        linkDirectionalParticles={(link: any) => link.relationship === "blocks" ? 2 : 0}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.006}
        d3VelocityDecay={0.25}
        d3AlphaDecay={0.02}
        warmupTicks={80}
        cooldownTicks={200}
        onEngineStop={() => fgRef.current?.zoomToFit(600, 80)}
        onZoom={({ k }: { k: number }) => setZoomLevel(k)}
        onNodeClick={(node: any) => setSelectedNode(node)}
        onBackgroundClick={() => setSelectedNode(null)}
        onNodeHover={(node: any) => setHoveredNode(node)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const r = (NODE_RADII[node.type] || 5);
          const isSelected = selectedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const color = NODE_COLORS[node.type] || "#94A3B8";

          // Glow ring for selected/hovered
          if (isSelected || isHovered) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
            ctx.fillStyle = color + "28";
            ctx.fill();
          }

          // Node circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? color : (isHovered ? color + "EE" : color + "CC");
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#ffffff" : color + "88";
          ctx.lineWidth = isSelected ? 2.5 : 1;
          ctx.stroke();

          // Labels: show short ID at normal zoom, full label at high zoom
          const rawLabel = node.label || "";
          let label: string;
          if (globalScale >= 2) {
            label = rawLabel.length > 28 ? rawLabel.slice(0, 28) + "…" : rawLabel;
          } else if (globalScale >= 0.8) {
            // Show just the ID part (before first space or first colon)
            const idPart = rawLabel.split(":")[0].trim();
            label = idPart.length <= 12 ? idPart : idPart.slice(0, 10) + "…";
          } else {
            // Too zoomed out — no label to avoid clutter
            return;
          }

          const fontSize = Math.max(8, Math.min(12, 10 / globalScale));
          ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
          const textW = ctx.measureText(label).width;
          const padding = 3;
          const boxW = textW + padding * 2;
          const boxH = fontSize + padding * 1.5;
          const bx = node.x - boxW / 2;
          const by = node.y + r + 3;

          // Label pill background
          ctx.beginPath();
          ctx.moveTo(bx + 3, by);
          ctx.lineTo(bx + boxW - 3, by);
          ctx.arcTo(bx + boxW, by, bx + boxW, by + 3, 3);
          ctx.lineTo(bx + boxW, by + boxH - 3);
          ctx.arcTo(bx + boxW, by + boxH, bx + boxW - 3, by + boxH, 3);
          ctx.lineTo(bx + 3, by + boxH);
          ctx.arcTo(bx, by + boxH, bx, by + boxH - 3, 3);
          ctx.lineTo(bx, by + 3);
          ctx.arcTo(bx, by, bx + 3, by, 3);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.93)";
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.06)";
          ctx.lineWidth = 0.5;
          ctx.stroke();

          ctx.fillStyle = "#111827";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, by + boxH / 2);
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const r = (NODE_RADII[node.type] || 5) + 6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
    </div>
  );
}
