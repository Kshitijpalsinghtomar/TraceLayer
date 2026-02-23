/**
 * AdminPage — System administration dashboard.
 * Contains: API key management, audit logs, pipeline logs,
 * system health, and admin-only configuration.
 *
 * Access control is handled at the route level by AdminGuard.tsx.
 * This component assumes the user is already verified as an admin.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Key,
  Activity,
  Terminal,
  Settings2,
  Eye,
  EyeOff,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  Database,
  FileText,
  HelpCircle,
  Search,
  Cpu,
} from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'System Overview', icon: Activity },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'audit', label: 'Audit Log', icon: FileText },
  { id: 'pipeline-logs', label: 'Pipeline Logs', icon: Terminal },
  { id: 'system', label: 'System Config', icon: Settings2 },
];

// ─── Main Admin Panel ────────────────────────────────────────────────────────

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 border-r border-border/50 bg-card/50 flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Admin Panel</h3>
              <p className="text-[10px] text-muted-foreground">System Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-left transition-all duration-150 ${activeTab === tab.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && <SystemOverview key="overview" />}
          {activeTab === 'api-keys' && <APIKeysManager key="api-keys" />}
          {activeTab === 'audit' && <AuditLog key="audit" />}
          {activeTab === 'pipeline-logs' && <PipelineLogs key="pipeline-logs" />}
          {activeTab === 'system' && <SystemConfig key="system" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── System Overview ─────────────────────────────────────────────────────────

function SystemOverview() {
  const settings = useQuery(api.settings.getAll);
  const apiKeys = useQuery(api.apiKeys.getActiveKeys);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 max-w-[1000px]">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight">System Overview</h2>
        <p className="text-[14px] text-muted-foreground mt-1">Monitor system health and key metrics</p>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <HealthCard
          icon={Key}
          label="API Keys"
          value={`${apiKeys?.length || 0} active`}
          status={apiKeys && apiKeys.length > 0 ? 'healthy' : 'warning'}
        />
        <HealthCard icon={Database} label="Backend" value="Convex" status="healthy" />
        <HealthCard icon={Cpu} label="Pipeline" value="Ready" status="healthy" />
        <HealthCard
          icon={Users}
          label="Mode"
          value="Admin"
          status="healthy"
        />
      </div>

      {/* Connected providers */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          AI Provider Status
        </h3>
        <div className="space-y-3">
          {['openai', 'gemini', 'anthropic'].map((provider) => {
            const key = apiKeys?.find((k) => k.provider === provider);
            return (
              <div key={provider} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${key ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <span className="text-[14px] font-medium capitalize">{provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google Gemini' : 'Anthropic'}</span>
                </div>
                <span className={`text-[12px] px-2.5 py-1 rounded-full ${key ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                  }`}>
                  {key ? `Connected (${key.keyPreview})` : 'Not configured'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* System settings preview */}
      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Active Settings
        </h3>
        {settings && Object.keys(settings).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 text-[13px]">
                <span className="text-muted-foreground font-mono">{key}</span>
                <span className="text-foreground font-medium truncate max-w-[300px]">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No custom settings configured</p>
        )}
      </div>
    </motion.div>
  );
}

function HealthCard({ icon: Icon, label, value, status }: { icon: any; label: string; value: string; status: 'healthy' | 'warning' | 'error' }) {
  const statusColors = {
    healthy: 'bg-emerald-50 border-emerald-200/40 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200/40 text-amber-700',
    error: 'bg-red-50 border-red-200/40 text-red-700',
  };
  const dotColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className={`rounded-2xl border p-5 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 opacity-70" />
        <div className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
      </div>
      <p className="text-[18px] font-bold">{value}</p>
      <p className="text-[11px] opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

// ─── API Keys Manager ────────────────────────────────────────────────────────

function APIKeysManager() {
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);
  const storeKey = useMutation(api.apiKeys.storeKey);
  const deleteKey = useMutation(api.apiKeys.deleteKey);

  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const providers = [
    { id: 'openai' as const, name: 'OpenAI', model: 'GPT-4o', placeholder: 'sk-...', color: '#10A37F' },
    { id: 'gemini' as const, name: 'Google Gemini', model: 'Gemini 2.0 Flash', placeholder: 'AIza...', color: '#4285F4' },
    { id: 'anthropic' as const, name: 'Anthropic', model: 'Claude 3.5 Sonnet', placeholder: 'sk-ant-...', color: '#D97757' },
  ];

  const handleSave = async (provider: 'openai' | 'gemini' | 'anthropic') => {
    const key = newKeys[provider];
    if (!key?.trim()) return;
    setSaving(provider);
    try {
      await storeKey({ provider, key: key.trim() });
      setNewKeys((prev) => ({ ...prev, [provider]: '' }));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (keyId: any) => {
    await deleteKey({ keyId });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 max-w-[800px]">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight">API Key Management</h2>
        <p className="text-[14px] text-muted-foreground mt-1">Configure AI provider keys for pipeline execution</p>
      </div>

      {/* Security notice */}
      <div className="bg-amber-50/60 rounded-2xl border border-amber-200/40 p-4 mb-6 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-amber-800">Security Notice</p>
          <p className="text-[12px] text-amber-700 mt-0.5">Keys are base64-encoded before storage and only used server-side during pipeline execution. Never exposed in client-side code. Only admins can view and manage API keys.</p>
        </div>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => {
          const existing = activeKeys?.find((k) => k.provider === provider.id);
          return (
            <div key={provider.id} className="bg-card rounded-2xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: provider.color + '15' }}>
                    <Cpu className="w-5 h-5" style={{ color: provider.color }} />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold">{provider.name}</h4>
                    <p className="text-[12px] text-muted-foreground">{provider.model}</p>
                  </div>
                </div>
                {existing && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>

              {existing && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-muted/30">
                  <Key className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[12px] font-mono text-muted-foreground flex-1">{existing.keyPreview}</span>
                  <button
                    onClick={() => handleDelete(existing._id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    value={newKeys[provider.id] || ''}
                    onChange={(e) => setNewKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                    placeholder={existing ? 'Replace key...' : provider.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all pr-9"
                  />
                  <button
                    onClick={() => setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys[provider.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={!newKeys[provider.id]?.trim() || saving === provider.id}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {saving === provider.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

function AuditLog() {
  const settings = useQuery(api.settings.getAll);

  // Simulate audit entries from settings changes
  const auditEntries = useMemo(() => {
    const entries = [];
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        entries.push({
          id: key,
          action: 'Setting changed',
          detail: `${key} = ${String(value).substring(0, 50)}`,
          timestamp: Date.now(),
          actor: 'Admin',
        });
      }
    }
    return entries;
  }, [settings]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 max-w-[900px]">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight">Audit Log</h2>
        <p className="text-[14px] text-muted-foreground mt-1">Track system changes and admin actions</p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_200px_120px_100px] gap-3 px-5 py-3 bg-muted/30 border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          <span>Action</span>
          <span>Detail</span>
          <span>Actor</span>
          <span>Time</span>
        </div>

        {auditEntries.length > 0 ? (
          <div className="divide-y divide-border/30">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[1fr_200px_120px_100px] gap-3 px-5 py-3.5 text-[13px] items-center hover:bg-muted/20 transition-colors">
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground truncate font-mono text-[11px]">{entry.detail}</span>
                <span className="text-muted-foreground">{entry.actor}</span>
                <span className="text-muted-foreground text-[11px]">Just now</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground text-[14px]">
            <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
            No audit entries yet
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pipeline Logs ───────────────────────────────────────────────────────────

function PipelineLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 max-w-[1000px]">
      <div className="mb-6">
        <h2 className="text-[22px] font-semibold tracking-tight">Pipeline Logs</h2>
        <p className="text-[14px] text-muted-foreground mt-1">View pipeline execution logs across all projects</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/60 bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
          {['all', 'info', 'warning', 'error'].map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-[12px] capitalize transition-all ${levelFilter === level
                  ? 'bg-card shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <div className="text-center py-12 text-muted-foreground">
          <Terminal className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[14px] font-medium mb-1">Pipeline Logs</p>
          <p className="text-[12px]">Logs will appear here when pipelines are executed. Go to a project's Control Center to run a pipeline.</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── System Config ───────────────────────────────────────────────────────────

function SystemConfig() {
  const setSetting = useMutation(api.settings.set);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 max-w-[800px]">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight">System Configuration</h2>
        <p className="text-[14px] text-muted-foreground mt-1">Manage system-wide settings and defaults</p>
      </div>

      <div className="space-y-6">
        {/* Pipeline defaults */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            Pipeline Defaults
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[14px] font-medium">Default AI Provider</p>
                <p className="text-[12px] text-muted-foreground">Provider used when running pipelines</p>
              </div>
              <select
                defaultValue="openai"
                onChange={(e) => setSetting({ key: 'default_provider', value: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border/60 text-[13px] bg-background"
              >
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="gemini">Gemini 2.0 Flash</option>
                <option value="anthropic">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[14px] font-medium">Auto-generate BRD</p>
                <p className="text-[12px] text-muted-foreground">Automatically generate BRD after pipeline completion</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-muted-foreground/20 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Data management */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Data Management
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[14px] font-medium">Convex Backend</p>
                <p className="text-[12px] text-muted-foreground">Real-time serverless database</p>
              </div>
              <span className="text-[12px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Help & support info */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Help & Support
          </h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Users can access the Help page for FAQs, documentation, and support. As an admin, you manage API keys, monitor pipeline execution, and configure system defaults. Users will see a simplified interface without access to API keys, pipeline controls, or system settings.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
