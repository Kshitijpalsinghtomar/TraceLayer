/**
 * SharedBRDView — Public view for shared BRD documents.
 * Accessed via /shared/:token route (no auth required).
 */
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams } from "react-router";
import { useEffect, useState } from "react";
import {
    FileText,
    Lock,
    Clock,
    AlertTriangle,
    Eye,
    Edit3,
    MessageSquare,
    Shield,
    ChevronDown,
    ChevronRight,
    Users,
    Zap,
    BarChart3,
    CheckCircle2,
    ExternalLink,
    Layers,
} from "lucide-react";

export function SharedBRDView() {
    const { token } = useParams<{ token: string }>();
    const data = useQuery(api.sharing.getByToken, token ? { token } : "skip");
    const recordAccess = useMutation(api.sharing.recordAccess);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["executiveSummary", "requirements", "stakeholders"])
    );

    // Record access on mount
    useEffect(() => {
        if (token && data && !data.error) {
            recordAccess({ token });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, !!data]);

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Loading
    if (!data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Loading shared document…</p>
                </div>
            </div>
        );
    }

    // Error states
    if (data.error === "not_found") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Link Not Found</h1>
                    <p className="text-sm text-slate-500">
                        This shared link doesn't exist or has been revoked. Ask the owner for a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (data.error === "expired") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h1>
                    <p className="text-sm text-slate-500">
                        This shared link has expired. Ask the owner to generate a new one.
                    </p>
                </div>
            </div>
        );
    }

    const { project, brdContent: brd, version, requirements, stakeholders, conflicts, sources, permission } = data;

    if (!brd) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">No BRD Available</h1>
                    <p className="text-sm text-slate-500">
                        The BRD for this project hasn't been generated yet.
                    </p>
                </div>
            </div>
        );
    }

    const permissionIcon = permission === "edit" ? Edit3 : permission === "comment" ? MessageSquare : Eye;
    const permissionLabel = permission === "edit" ? "Can Edit" : permission === "comment" ? "Can Comment" : "View Only";
    const permissionColor = permission === "edit" ? "text-emerald-600 bg-emerald-50" : permission === "comment" ? "text-blue-600 bg-blue-50" : "text-slate-600 bg-slate-100";

    const PermIcon = permissionIcon;

    const sections = [
        { key: "executiveSummary", label: "Executive Summary", icon: FileText, content: brd.executiveSummary },
        { key: "projectOverview", label: "Project Overview", icon: FileText, content: brd.projectOverview },
        { key: "scopeDefinition", label: "Scope Definition", icon: Layers, content: brd.scopeDefinition || brd.scope_definition },
        { key: "businessObjectives", label: "Business Objectives", icon: Zap, content: brd.businessObjectives },
        { key: "stakeholderAnalysis", label: "Stakeholder Analysis", icon: Users, content: brd.stakeholderAnalysis || brd.stakeholder_analysis },
        { key: "functionalAnalysis", label: "Functional Analysis", icon: BarChart3, content: brd.functionalAnalysis },
        { key: "nonFunctionalAnalysis", label: "Non-Functional Analysis", icon: Shield, content: brd.nonFunctionalAnalysis },
        { key: "decisionAnalysis", label: "Decision Analysis", icon: Zap, content: brd.decisionAnalysis },
        { key: "riskAssessment", label: "Risk Assessment", icon: AlertTriangle, content: brd.riskAssessment },
    ].filter((s) => s.content);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
            {/* ── Top Bar ── */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">{project?.name}</p>
                            <p className="text-[11px] text-slate-500">BRD v{version}.0 · Shared via TraceLayer</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium ${permissionColor}`}>
                            <PermIcon className="w-3.5 h-3.5" />
                            {permissionLabel}
                        </div>
                        <a
                            href="/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open TraceLayer
                        </a>
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Requirements", value: requirements?.length || 0, color: "text-indigo-600 bg-indigo-50" },
                        { label: "Stakeholders", value: stakeholders?.length || 0, color: "text-emerald-600 bg-emerald-50" },
                        { label: "Sources", value: sources?.length || 0, color: "text-amber-600 bg-amber-50" },
                        { label: "Conflicts", value: conflicts?.length || 0, color: "text-red-600 bg-red-50" },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${stat.color.split(" ")[0]}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* BRD Sections */}
                <div className="space-y-4">
                    {sections.map((section) => {
                        const isOpen = expandedSections.has(section.key);
                        const SIcon = section.icon;
                        return (
                            <div key={section.key} className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => toggleSection(section.key)}
                                    className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                        <SIcon className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <span className="text-[15px] font-semibold text-slate-900 flex-1">{section.label}</span>
                                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </button>
                                {isOpen && (
                                    <div className="px-6 pb-5 pt-0">
                                        <div className="border-t border-slate-100 pt-4 text-sm text-slate-700 leading-relaxed">
                                            {typeof section.content === "string" ? (
                                                <div className="whitespace-pre-wrap">{section.content}</div>
                                            ) : Array.isArray(section.content) ? (
                                                <div className="space-y-4">
                                                    {section.content.map((item: any, idx: number) => (
                                                        <div key={item.id || idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {item.id && <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{item.id}</span>}
                                                                <h4 className="text-[14px] font-semibold text-slate-900">{item.title || item.name || `Item ${idx + 1}`}</h4>
                                                            </div>
                                                            {item.description && <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{item.description}</p>}
                                                            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
                                                                {item.owner && <span className="text-slate-500"><strong className="text-slate-700">Owner:</strong> {item.owner}</span>}
                                                                {item.successCriteria && <span className="text-slate-500"><strong className="text-slate-700">Success:</strong> {item.successCriteria}</span>}
                                                                {item.metrics && <span className="text-slate-500"><strong className="text-slate-700">Metrics:</strong> {item.metrics}</span>}
                                                                {item.linkedRequirements?.length > 0 && (
                                                                    <span className="text-slate-500">
                                                                        <strong className="text-slate-700">Linked:</strong>{" "}
                                                                        {item.linkedRequirements.map((r: string) => (
                                                                            <span key={r} className="inline-block bg-indigo-50 text-indigo-600 text-[11px] font-mono px-1.5 py-0.5 rounded mr-1">{r}</span>
                                                                        ))}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : typeof section.content === "object" && section.content !== null ? (
                                                <div className="space-y-3">
                                                    {Object.entries(section.content as Record<string, any>).map(([key, val]) => (
                                                        <div key={key}>
                                                            <p className="text-[12px] font-semibold text-slate-800 capitalize mb-1">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                                                            {typeof val === "string" ? (
                                                                <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{val}</p>
                                                            ) : Array.isArray(val) ? (
                                                                <ul className="list-disc list-inside text-[13px] text-slate-600 space-y-0.5">
                                                                    {val.map((v: any, i: number) => <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-[13px] text-slate-600">{String(val)}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="whitespace-pre-wrap">{String(section.content)}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Requirements Table */}
                    {requirements && requirements.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection("requirements")}
                                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span className="text-[15px] font-semibold text-slate-900 flex-1">
                                    Requirements ({requirements.length})
                                </span>
                                {expandedSections.has("requirements") ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                            {expandedSections.has("requirements") && (
                                <div className="px-6 pb-5">
                                    <div className="border-t border-slate-100 pt-4 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    <th className="pb-3 pr-4">ID</th>
                                                    <th className="pb-3 pr-4">Title</th>
                                                    <th className="pb-3 pr-4">Priority</th>
                                                    <th className="pb-3 pr-4">Category</th>
                                                    <th className="pb-3">Confidence</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {requirements.map((req: any) => (
                                                    <tr key={req._id} className="group">
                                                        <td className="py-3 pr-4 font-mono text-[12px] text-indigo-600 font-medium">{req.requirementId}</td>
                                                        <td className="py-3 pr-4 text-slate-900 font-medium">{req.title}</td>
                                                        <td className="py-3 pr-4">
                                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${req.priority === "critical" ? "bg-red-50 text-red-600" :
                                                                req.priority === "high" ? "bg-amber-50 text-amber-600" :
                                                                    req.priority === "medium" ? "bg-blue-50 text-blue-600" :
                                                                        "bg-slate-100 text-slate-600"
                                                                }`}>
                                                                {req.priority}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 pr-4 text-slate-500 capitalize text-[12px]">{req.category}</td>
                                                        <td className="py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-indigo-500"
                                                                        style={{ width: `${Math.round((req.confidenceScore || 0) * 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[11px] text-slate-500 font-medium">
                                                                    {Math.round((req.confidenceScore || 0) * 100)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stakeholders */}
                    {stakeholders && stakeholders.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection("stakeholders")}
                                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span className="text-[15px] font-semibold text-slate-900 flex-1">
                                    Stakeholders ({stakeholders.length})
                                </span>
                                {expandedSections.has("stakeholders") ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                            {expandedSections.has("stakeholders") && (
                                <div className="px-6 pb-5">
                                    <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                                        {stakeholders.map((sh: any) => (
                                            <div key={sh._id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                                                    {(sh.name || "?")[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{sh.name}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">{sh.role} · {sh.influence}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Conflicts */}
                    {conflicts && conflicts.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection("conflicts")}
                                className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                </div>
                                <span className="text-[15px] font-semibold text-slate-900 flex-1">
                                    Conflicts ({conflicts.length})
                                </span>
                                {expandedSections.has("conflicts") ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                            {expandedSections.has("conflicts") && (
                                <div className="px-6 pb-5">
                                    <div className="border-t border-slate-100 pt-4 space-y-3">
                                        {conflicts.map((c: any) => (
                                            <div key={c._id} className="p-4 rounded-lg bg-red-50/50 border border-red-100">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${c.severity === "critical" ? "bg-red-100 text-red-700" :
                                                        c.severity === "major" ? "bg-amber-100 text-amber-700" :
                                                            "bg-slate-100 text-slate-600"
                                                        }`}>
                                                        {c.severity}
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-900">{c.title}</span>
                                                </div>
                                                <p className="text-[13px] text-slate-600 leading-relaxed">{c.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center pb-8">
                    <div className="flex items-center justify-center gap-2 text-[12px] text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                        Shared via TraceLayer · {permissionLabel} access
                    </div>
                </div>
            </div>
        </div>
    );
}
