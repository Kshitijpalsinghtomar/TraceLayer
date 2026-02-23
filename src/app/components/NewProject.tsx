/**
 * NewProject — Redesigned project creation flow
 * Two-step wizard: (1) Project details → (2) Output format selection
 * with animated transitions, progress indicator, and polished glass-morphism cards.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  Sparkles,
  Check,
  Loader2,
  Briefcase,
  Target,
  FolderPlus,
  Lock,
  BookOpen,
  ClipboardList,
  FileCode,
} from 'lucide-react';

type OutputFormat = 'brd';
type Step = 1 | 2;

const comingSoonFormats: {
  label: string;
  sublabel: string;
  icon: typeof FileText;
  description: string;
}[] = [
    {
      label: 'PRD',
      sublabel: 'Product Requirements Document',
      icon: Target,
      description: 'Technical product spec with user stories, personas, and acceptance criteria.',
    },
    {
      label: 'SRS',
      sublabel: 'Software Requirements Specification',
      icon: FileCode,
      description: 'IEEE-standard software requirements with functional & interface specs.',
    },
    {
      label: 'FSD',
      sublabel: 'Functional Specification Document',
      icon: ClipboardList,
      description: 'Detailed functional behavior, workflows, and system interaction maps.',
    },
    {
      label: 'TDD',
      sublabel: 'Technical Design Document',
      icon: BookOpen,
      description: 'Architecture diagrams, data models, API contracts, and tech decisions.',
    },
  ];

export function NewProject() {
  const navigate = useNavigate();
  const { convexUser } = useAuth();
  const createProject = useMutation(api.projects.create);
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('brd');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const projectId = await createProject({
        name: name.trim(),
        description: description.trim() || 'No description provided',
        outputFormat,
        userId: convexUser?._id,
      });
      navigate(`/projects/${projectId}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setCreating(false);
    }
  };

  const canProceed = name.trim().length > 0;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-60px)] py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[620px] px-8"
      >
        {/* Back link */}
        <button
          onClick={() => step === 1 ? navigate('/projects') : setStep(1)}
          className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {step === 1 ? 'Back to projects' : 'Back to details'}
        </button>

        {/* Progress Stepper */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-300 ${step >= s
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-muted text-muted-foreground'
                  }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-[13px] font-medium transition-colors ${step >= s ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Project Details' : 'Output Format'}
              </span>
              {s === 1 && (
                <div className="flex-1 h-px bg-border mx-2">
                  <div className={`h-full bg-primary transition-all duration-500 ${step > 1 ? 'w-full' : 'w-0'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center">
            <FolderPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] tracking-[-0.02em] font-semibold">
              {step === 1 ? 'Create a new project' : 'Choose output format'}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5">
              {step === 1
                ? 'Name your project and describe its purpose.'
                : 'Select the type of document you want to generate.'}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
                <div>
                  <label className="text-[13px] text-muted-foreground mb-2 block">Project Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Meridian Mobile App Redesign"
                    autoFocus
                    className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[13px] text-muted-foreground mb-2 block">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview of the project scope, goals, and key deliverables..."
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Tips */}
              <div className="bg-primary/4 dark:bg-primary/8 border border-primary/10 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] text-foreground font-medium mb-0.5">Pro tip</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    A clear project name and detailed description help the AI better contextualize extracted requirements and generate more accurate documents.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceed}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* BRD — Active format */}
              <div
                className="w-full rounded-2xl border p-5 text-left flex items-start gap-4 border-primary/40 bg-primary/4 dark:bg-primary/8 ring-1 ring-primary/15 shadow-sm shadow-primary/5"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-primary/12 text-primary">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-medium">BRD</span>
                    <span className="text-[12px] text-muted-foreground">Business Requirements Document</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-2.5">
                    Structured document covering business objectives, functional requirements, stakeholders, and timeline. Best for stakeholder alignment.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Objectives', 'Requirements', 'Stakeholders', 'Timeline'].map((tag) => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-primary/8 text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 border-primary bg-primary">
                  <Check className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* Coming Soon divider */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">Coming Soon</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Future document types */}
              <div className="grid grid-cols-2 gap-3">
                {comingSoonFormats.map((fmt) => {
                  const Icon = fmt.icon;
                  return (
                    <div
                      key={fmt.label}
                      className="rounded-xl border border-border/60 bg-muted/30 p-4 opacity-60 relative overflow-hidden"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[13px] font-medium text-foreground/70">{fmt.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">{fmt.sublabel}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {fmt.description}
                      </p>
                      <div className="absolute top-2.5 right-2.5">
                        <Lock className="w-3 h-3 text-muted-foreground/40" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
