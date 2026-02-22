import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  MessageCircle,
  FileQuestion,
  ExternalLink,
  ChevronDown,
  ArrowUpRight,
  Layers,
  Zap,
  FileText,
  GitBranch,
  Search,
  Mail,
  MessageSquare,
  FileCheck,
  Shield,
  Clock,
  ArrowRight,
  Settings,
  FolderOpen,
  Users,
  Lightbulb,
  Video,
  Mailbox,
} from 'lucide-react';

const faqs = [
  {
    q: 'What types of communication can TraceLayer process?',
    a: 'TraceLayer currently supports plain text files (.txt), PDFs, Word documents (.docx), email exports (.eml), CSV files, and JSON. Native integrations with Gmail, Slack, and Notion are coming soon.',
    category: 'getting-started',
  },
  {
    q: 'How does TraceLayer identify requirements vs. general discussion?',
    a: 'The AI intelligence layer applies a multi-stage filter: first removing noise (pleasantries, status updates), then detecting linguistic patterns that signal requirements ("must", "shall", "needs to"), decisions, constraints, and stakeholder positions. Each extraction includes a confidence score.',
    category: 'features',
  },
  {
    q: 'What is the Traceability Matrix?',
    a: 'The Traceability Matrix is a structured table in the BRD that links every extracted requirement back to its original communication source — the email, Slack message, or meeting transcript it came from. This lets teams verify, audit, and defend every requirement in the document.',
    category: 'features',
  },
  {
    q: 'What is the difference between a BRD and a PRD in TraceLayer?',
    a: 'The BRD (Business Requirements Document) focuses on what the business needs — objectives, stakeholders, functional requirements, and constraints. The PRD (Product Requirements Document) is generated from the BRD and translates those needs into user stories, personas, and acceptance criteria for product and engineering teams.',
    category: 'features',
  },
  {
    q: 'Can I edit requirements after they\'ve been extracted?',
    a: 'Yes. Any requirement in the BRD can be manually edited, its status changed, or its source annotation updated. All edits are versioned and the original source excerpt is preserved for audit purposes.',
    category: 'features',
  },
  {
    q: 'Is my data secure?',
    a: 'Communication data is processed in an isolated pipeline and never used to train models. Files are stored encrypted at rest (AES-256) and deleted after processing unless you opt to retain them. In production, TraceLayer targets SOC 2 Type II compliance.',
    category: 'security',
  },
  {
    q: 'How do I invite team members to my project?',
    a: 'Open your project and navigate to Settings. From there, you can invite team members by entering their email addresses. They will receive an invitation to join your project workspace.',
    category: 'getting-started',
  },
  {
    q: 'What AI models does TraceLayer use?',
    a: 'TraceLayer uses OpenAI\'s GPT-4 for requirement extraction and document generation. You can configure your own API key in Settings > AI Settings for custom model preferences.',
    category: 'features',
  },
];

const flowSteps = [
  {
    icon: Layers,
    label: 'Create Project',
    description: 'Name your project and define the business context.',
    color: '#6B7AE8',
  },
  {
    icon: FileText,
    label: 'Upload Sources',
    description: 'Add emails, meeting transcripts, Slack exports, or documents.',
    color: '#66BB8C',
  },
  {
    icon: Zap,
    label: 'AI Processing',
    description: 'The intelligence layer extracts requirements, decisions, and stakeholders.',
    color: '#E8A838',
  },
  {
    icon: GitBranch,
    label: 'Review BRD',
    description: 'Explore the structured BRD with full source tracing.',
    color: '#D4738C',
  },
];

const helpCategories = [
  { 
    icon: FolderOpen, 
    label: 'Getting Started', 
    description: 'Learn the basics of TraceLayer',
    href: '#getting-started',
    color: '#6B7AE8',
  },
  { 
    icon: FileCheck, 
    label: 'Requirements', 
    description: 'Understanding requirement extraction',
    href: '#requirements',
    color: '#66BB8C',
  },
  { 
    icon: Users, 
    label: 'Collaboration', 
    description: 'Team features and sharing',
    href: '#collaboration',
    color: '#E8A838',
  },
  { 
    icon: Shield, 
    label: 'Security', 
    description: 'Data privacy and security',
    href: '#security',
    color: '#D4738C',
  },
];

export function HelpView() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch = 
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'features', label: 'Features' },
    { id: 'collaboration', label: 'Collaboration' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="px-10 py-8 max-w-[900px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-[32px] tracking-[-0.02em] mb-3">How can we help?</h1>
          <p className="text-[15px] text-muted-foreground mb-6">
            Find answers to common questions and learn how to use TraceLayer effectively.
          </p>
          
          {/* Search bar */}
          <div className="relative max-w-[500px] mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help articles, guides, FAQs..."
              className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
            />
          </div>
        </div>

        {/* Quick category cards */}
        {!searchQuery && (
          <div className="grid grid-cols-4 gap-4 mb-10">
            {helpCategories.map((cat) => (
              <a
                key={cat.label}
                href={cat.href}
                className="bg-card rounded-2xl border border-border p-5 cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 group text-center"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <p className="text-[14px] font-medium mb-1">{cat.label}</p>
                <p className="text-[12px] text-muted-foreground">{cat.description}</p>
              </a>
            ))}
          </div>
        )}

        {!searchQuery && (
          /* How it works */
          <div className="mb-10">
            <h2 className="text-[18px] tracking-[-0.01em] mb-5">How TraceLayer works</h2>
            <div className="relative">
              {/* Connector line */}
              <div className="absolute top-[22px] left-[22px] right-[22px] h-px bg-border" />
              <div className="grid grid-cols-4 gap-4 relative">
                {flowSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex flex-col items-center text-center">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center mb-3 z-10 ring-4 ring-background"
                        style={{ backgroundColor: `${step.color}18` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: step.color }} />
                      </div>
                      <div
                        className="text-[11px] font-mono mb-1 px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${step.color}12`, color: step.color }}
                      >
                        Step {i + 1}
                      </div>
                      <p className="text-[13px] mb-1">{step.label}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        {!searchQuery && (
          <div className="grid grid-cols-2 gap-4 mb-10">
            {[
              { icon: BookOpen, label: 'Documentation', description: 'Full guides and tutorials', href: '#' },
              { icon: Video, label: 'Video Tutorials', description: 'Watch how-to videos', href: '#' },
              { icon: MessageSquare, label: 'Community Forum', description: 'Connect with other users', href: '#' },
              { icon: Mailbox, label: 'Contact Support', description: 'Get direct help', href: '#contact' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="bg-card rounded-2xl border border-border p-5 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 group flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/6 flex items-center justify-center shrink-0">
                  <item.icon className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] mb-0.5">{item.label}</p>
                  <p className="text-[12px] text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {/* FAQ Section */}
        <div id="faq">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] tracking-[-0.01em]">Frequently Asked Questions</h2>
          </div>

          {/* Category filters */}
          {!searchQuery && (
            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-[13px] whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* FAQ list */}
          <div className="space-y-2">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-[14px] text-muted-foreground">
                  {searchQuery 
                    ? `No results found for "${searchQuery}"`
                    : 'No questions in this category'
                  }
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-[13px] text-primary hover:underline mt-2"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredFaqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-card rounded-2xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-[14px] pr-4 font-medium">{faq.q}</p>
                    <motion.div
                      animate={{ rotate: openFaq === i ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0"
                    >
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div className="border-t border-border px-6 py-4">
                          <p className="text-[14px] text-muted-foreground leading-[1.7]">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        {!searchQuery && (
          <div className="mb-10">
            <h2 className="text-[18px] tracking-[-0.01em] mb-5">Keyboard Shortcuts</h2>
            <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {[
                { keys: ['Ctrl', 'J'], label: 'Open AI Copilot' },
                { keys: ['Ctrl', 'K'], label: 'Open Command Palette' },
                { keys: ['Ctrl', 'N'], label: 'New Project' },
                { keys: ['Ctrl', '/'], label: 'Focus Search' },
              ].map((shortcut) => (
                <div key={shortcut.label} className="flex items-center justify-between px-6 py-3">
                  <span className="text-[14px]">{shortcut.label}</span>
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="px-2 py-0.5 bg-muted/70 border border-border rounded-md text-[12px] font-mono text-muted-foreground"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact CTA */}
        <div id="contact" className="mt-10 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-[18px] mb-2">Still need help?</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[400px] mx-auto mb-5">
            Our support team is here to help you get the most out of TraceLayer. 
            We typically respond within a few hours.
          </p>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-[14px] hover:bg-primary/90 transition-colors mx-auto">
            <MessageCircle className="w-4 h-4" />
            Contact Support
          </button>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex items-center justify-center gap-6 text-[13px] text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Changelog</a>
        </div>
      </motion.div>
    </div>
  );
}
