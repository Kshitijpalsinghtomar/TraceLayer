import { useQuery } from 'convex/react';
import { useParams, useNavigate } from 'react-router';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
    FileText,
    Package,
    Cog,
    Ruler,
    Building,
    TestTube,
    CheckCircle,
    Grid3X3,
    ChevronRight,
    Lock,
    Sparkles,
    ArrowRight,
    Check,
} from 'lucide-react';

// Icon map for document types
const iconMap: Record<string, React.ElementType> = {
    FileText, Package, Cog, Ruler, Building, TestTube, CheckCircle,
    Grid: Grid3X3,
};

// Document type info (fallback when DB isn't seeded yet)
const CHAIN = [
    { key: 'brd', label: 'BRD', full: 'Business Requirements Document', icon: FileText, color: '#6366f1', order: 1 },
    { key: 'prd', label: 'PRD', full: 'Product Requirements Document', icon: Package, color: '#8b5cf6', order: 2 },
    { key: 'frd', label: 'FRD', full: 'Functional Requirements Document', icon: Cog, color: '#a78bfa', order: 3 },
    { key: 'srs', label: 'SRS', full: 'Software Requirements Specification', icon: Ruler, color: '#7c3aed', order: 4 },
    { key: 'trd', label: 'TRD/SDD', full: 'Technical Design Document', icon: Building, color: '#6d28d9', order: 5 },
    { key: 'test_plan', label: 'Test Plan', full: 'Test Plan', icon: TestTube, color: '#5b21b6', order: 6 },
    { key: 'uat', label: 'UAT', full: 'User Acceptance Testing', icon: CheckCircle, color: '#4c1d95', order: 7 },
    { key: 'rtm', label: 'RTM', full: 'Traceability Matrix', icon: Grid3X3, color: '#3b0764', order: 8 },
];

type DocStatus = 'completed' | 'ready' | 'locked' | 'generating';

/**
 * DocumentChainView — the "Domino Document Chain" UI
 * Shows all 8 document types in sequence with their status for the current project.
 */
export function DocumentChainView() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    // Get project and its documents
    const project = useQuery(
        api.projects.get,
        projectId ? { projectId: projectId as Id<"projects"> } : "skip"
    );
    const documents = useQuery(
        api.documents.listByProject,
        projectId ? { projectId: projectId as Id<"projects"> } : "skip"
    );

    if (!project) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">Loading project...</div>
            </div>
        );
    }

    // Determine status of each document in the chain
    const getDocStatus = (docKey: string, index: number): DocStatus => {
        if (!documents) return index === 0 ? 'ready' : 'locked';

        const doc = documents.find((d: any) => d.type === docKey);
        if (doc && doc.status === 'generating') return 'generating';
        if (doc && doc.status === 'ready') return 'completed';

        // Check if predecessor is completed
        if (index === 0) return 'ready';
        const prevKey = CHAIN[index - 1].key;
        const prevDoc = documents.find((d: any) => d.type === prevKey);
        if (prevDoc && prevDoc.status === 'ready') return 'ready';

        return 'locked';
    };

    // Get parent document label for lineage display
    const getParentLabel = (docKey: string): string | null => {
        if (!documents) return null;
        const doc = documents.find((d: any) => d.type === docKey);
        if (!doc || !doc.parentDocumentId) return null;
        const parent = documents.find((d: any) => d._id === doc.parentDocumentId);
        if (!parent) return null;
        const parentInfo = CHAIN.find((c) => c.key === parent.type);
        return parentInfo ? parentInfo.label : parent.type?.toUpperCase();
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight mb-2">Document Chain</h1>
                <p className="text-muted-foreground text-sm">
                    Each document builds on the previous one. Generate them in sequence for maximum accuracy and traceability.
                </p>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
                {(() => {
                    const completed = CHAIN.filter((c, i) => getDocStatus(c.key, i) === 'completed').length;
                    const pct = Math.round((completed / CHAIN.length) * 100);
                    return (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Chain Progress</span>
                                <span className="text-xs font-medium text-foreground">{completed}/{CHAIN.length} documents</span>
                            </div>
                            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Chain cards */}
            <div className="space-y-3">
                {CHAIN.map((doc, index) => {
                    const status = getDocStatus(doc.key, index);
                    const Icon = doc.icon;

                    return (
                        <div key={doc.key}>
                            {/* Connector line */}
                            {index > 0 && (
                                <div className="flex items-center justify-center py-1">
                                    <div className={`w-px h-6 ${status === 'locked' ? 'bg-border/50' : 'bg-gradient-to-b from-primary/40 to-primary/20'
                                        }`} />
                                </div>
                            )}

                            {/* Card */}
                            <button
                                onClick={() => {
                                    if (status === 'completed' && doc.key === 'brd') {
                                        navigate(`/projects/${projectId}/brd`);
                                    }
                                }}
                                disabled={status === 'locked'}
                                className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 group ${status === 'completed'
                                    ? 'bg-card border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                                    : status === 'ready'
                                        ? 'bg-card border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/10 cursor-pointer'
                                        : status === 'generating'
                                            ? 'bg-card border-amber-500/30 animate-pulse'
                                            : 'bg-muted/20 border-border/30 opacity-60 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Step number + icon */}
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status === 'completed'
                                            ? 'bg-primary/10'
                                            : status === 'ready'
                                                ? 'bg-gradient-to-br from-primary/20 to-violet-500/20'
                                                : status === 'generating'
                                                    ? 'bg-amber-500/10'
                                                    : 'bg-muted/30'
                                            }`}
                                    >
                                        {status === 'completed' ? (
                                            <Check className="w-5 h-5 text-primary" />
                                        ) : status === 'locked' ? (
                                            <Lock className="w-5 h-5 text-muted-foreground/50" />
                                        ) : status === 'generating' ? (
                                            <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
                                        ) : (
                                            <Icon className="w-5 h-5" style={{ color: doc.color }} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                                Step {doc.order}
                                            </span>
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status === 'completed'
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : status === 'ready'
                                                        ? 'bg-primary/10 text-primary'
                                                        : status === 'generating'
                                                            ? 'bg-amber-500/10 text-amber-500'
                                                            : 'bg-muted/30 text-muted-foreground/50'
                                                    }`}
                                            >
                                                {status === 'completed' ? 'Completed' :
                                                    status === 'ready' ? 'Ready' :
                                                        status === 'generating' ? 'Generating...' :
                                                            'Locked'}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-medium mt-0.5">{doc.full}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                {doc.label} — {
                                                    doc.key === 'brd' ? 'Business objectives, stakeholders, and high-level requirements' :
                                                        doc.key === 'prd' ? 'Features, user stories, and acceptance criteria' :
                                                            doc.key === 'frd' ? 'Detailed functional specifications and business rules' :
                                                                doc.key === 'srs' ? 'Technical specs — performance, security, compliance' :
                                                                    doc.key === 'trd' ? 'System architecture, database design, API contracts' :
                                                                        doc.key === 'test_plan' ? 'Testing strategy, test cases, and environments' :
                                                                            doc.key === 'uat' ? 'User acceptance criteria and sign-off' :
                                                                                'Maps every requirement from source to test'
                                                }
                                            </p>
                                            {getParentLabel(doc.key) && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 whitespace-nowrap">
                                                    From: {getParentLabel(doc.key)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="shrink-0">
                                        {status === 'ready' && (
                                            <div className="flex items-center gap-1.5 text-primary text-sm font-medium group-hover:gap-2.5 transition-all">
                                                <Sparkles className="w-4 h-4" />
                                                Generate
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                        {status === 'completed' && (
                                            <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Info footer */}
            <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-foreground">How the chain works</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Each document is generated using AI that leverages all the intelligence from its predecessor.
                            The BRD feeds into the PRD, which feeds into the FRD, and so on — creating a traceable
                            chain from business objectives all the way to test cases. You can skip documents you don't
                            need, but the chain ensures consistency and completeness.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
