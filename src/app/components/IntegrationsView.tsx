/**
 * IntegrationsView — Full integration hub with per-app data control.
 * Spacious card grid, prominent connected section, clean visual hierarchy.
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNavigate } from "react-router";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CheckCircle2,
  Zap,
  RefreshCw,
  ExternalLink,
  Mail,
  MessageSquare,
  FileText,
  Video,
  Database,
  GitBranch,
  Network,
  ArrowRight,
  Shield,
  Bot,
  Settings2,
  Pause,
  Play,
  Trash2,
  X,
  CalendarDays,
  FolderOpen,
  Hash,
  Tag,
  Paperclip,
  MessageCircle,
  Search,
  LayoutGrid,
  Cloud,
  Figma,
  Kanban,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Cable,
  ChevronRight,
  Crosshair,
  Clock,
  Users,
  AlertTriangle,
} from "lucide-react";

// ─── Type Definitions ─────────────────────────────────────────────────────────
interface AppDefinition {
  id: string;
  name: string;
  description: string;
  category: Category;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  docsUrl?: string;
  tokenPageUrl?: string;
  tokenFormatHint?: string;
  scopeFields: ScopeField[];
  permissions: string[];
}

type Category =
  | "Communication"
  | "Project Management"
  | "Documentation"
  | "Code & DevOps"
  | "Design"
  | "Cloud Storage"
  | "Email"
  | "Meetings";

type ScopeField =
  | "channels"
  | "repos"
  | "projects"
  | "pages"
  | "folders"
  | "labels"
  | "dateRange"
  | "includeComments"
  | "includeAttachments";

// ─── Integration Catalog (22 apps) ────────────────────────────────────────────
const APP_CATALOG: AppDefinition[] = [
  {
    id: "slack", name: "Slack",
    description: "Monitor channels for decisions, action items, and implicit requirements in team discussions.",
    category: "Communication", icon: MessageSquare, color: "#4A154B",
    docsUrl: "https://api.slack.com/docs", tokenPageUrl: "https://api.slack.com/apps",
    tokenFormatHint: "Bot User OAuth Token (xoxb-...)",
    scopeFields: ["channels", "dateRange", "includeAttachments"],
    permissions: ["channels:read", "channels:history", "files:read"],
  },
  {
    id: "discord", name: "Discord",
    description: "Extract discussions from server channels, threads, and voice channel transcripts.",
    category: "Communication", icon: MessageCircle, color: "#5865F2",
    docsUrl: "https://discord.com/developers/docs", tokenPageUrl: "https://discord.com/developers/applications",
    tokenFormatHint: "Bot Token from Developer Portal",
    scopeFields: ["channels", "dateRange"], permissions: ["guilds", "messages.read"],
  },
  {
    id: "ms_teams", name: "Microsoft Teams",
    description: "Pull messages, meeting notes, and shared files from Teams channels and chats.",
    category: "Communication", icon: MessageSquare, color: "#6264A7",
    docsUrl: "https://learn.microsoft.com/en-us/graph/teams-concept-overview",
    tokenPageUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    tokenFormatHint: "Microsoft Graph Access Token",
    scopeFields: ["channels", "dateRange", "includeAttachments"],
    permissions: ["ChannelMessage.Read", "Chat.Read"],
  },
  {
    id: "jira", name: "Jira",
    description: "Import epics, stories, bugs, and sprint data. Map issues to extracted requirements.",
    category: "Project Management", icon: Kanban, color: "#0052CC",
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3",
    tokenPageUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    tokenFormatHint: "domain.atlassian.net|email@example.com:api_token",
    scopeFields: ["projects", "labels", "dateRange", "includeComments", "includeAttachments"],
    permissions: ["read:jira-work", "read:jira-user"],
  },
  {
    id: "linear", name: "Linear",
    description: "Sync issues, projects, and cycles. Extract priorities and acceptance criteria.",
    category: "Project Management", icon: ArrowRight, color: "#5E6AD2",
    docsUrl: "https://developers.linear.app/docs", tokenPageUrl: "https://linear.app/settings/api",
    tokenFormatHint: "Personal API Key (lin_api_...)",
    scopeFields: ["projects", "labels", "dateRange", "includeComments"], permissions: ["read"],
  },
  {
    id: "asana", name: "Asana",
    description: "Pull tasks, projects, and portfolios. Capture dependencies and milestones.",
    category: "Project Management", icon: CheckCircle2, color: "#F06A6A",
    docsUrl: "https://developers.asana.com/docs", tokenPageUrl: "https://app.asana.com/-/developer_console",
    tokenFormatHint: "Personal Access Token",
    scopeFields: ["projects", "dateRange", "includeComments", "includeAttachments"],
    permissions: ["default"],
  },
  {
    id: "trello", name: "Trello",
    description: "Import boards, cards, and checklists. Extract requirements from card descriptions.",
    category: "Project Management", icon: LayoutGrid, color: "#0079BF",
    docsUrl: "https://developer.atlassian.com/cloud/trello", tokenPageUrl: "https://trello.com/app-key",
    tokenFormatHint: "apiKey|oauthToken",
    scopeFields: ["projects", "labels", "includeComments", "includeAttachments"], permissions: ["read"],
  },
  {
    id: "monday", name: "Monday.com",
    description: "Sync boards and items. Extract workflow stages, assignees, and status data.",
    category: "Project Management", icon: LayoutGrid, color: "#FF3D57",
    docsUrl: "https://developer.monday.com/api-reference", tokenPageUrl: "https://auth.monday.com/oauth2/authorize",
    tokenFormatHint: "API Token from Admin > API",
    scopeFields: ["projects", "dateRange", "includeComments"], permissions: ["boards:read"],
  },
  {
    id: "notion", name: "Notion",
    description: "Pull meeting notes, specs, and wiki pages. Sync databases and linked content.",
    category: "Documentation", icon: FileText, color: "#9B9B9B",
    docsUrl: "https://developers.notion.com", tokenPageUrl: "https://www.notion.so/my-integrations",
    tokenFormatHint: "Internal Integration Token (secret_...)",
    scopeFields: ["pages", "dateRange", "includeComments"], permissions: ["read_content"],
  },
  {
    id: "confluence", name: "Confluence",
    description: "Import team wiki, technical specs, architecture decision records, and spaces.",
    category: "Documentation", icon: Database, color: "#0052CC",
    docsUrl: "https://developer.atlassian.com/cloud/confluence/rest",
    tokenPageUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    tokenFormatHint: "domain.atlassian.net|email@example.com:api_token",
    scopeFields: ["pages", "dateRange", "includeComments", "includeAttachments"],
    permissions: ["read:confluence-content.all"],
  },
  {
    id: "google_docs", name: "Google Docs",
    description: "Extract content from documents, spreadsheets, and presentations in Google Workspace.",
    category: "Documentation", icon: FileText, color: "#4285F4",
    docsUrl: "https://developers.google.com/docs/api",
    tokenPageUrl: "https://console.cloud.google.com/apis/credentials",
    tokenFormatHint: "OAuth 2.0 Access Token",
    scopeFields: ["folders", "dateRange"], permissions: ["drive.readonly", "documents.readonly"],
  },
  {
    id: "coda", name: "Coda",
    description: "Sync Coda docs and tables. Extract structured data and formulas as requirements.",
    category: "Documentation", icon: FileText, color: "#F46A54",
    docsUrl: "https://coda.io/developers/apis/v1", tokenPageUrl: "https://coda.io/account#apiSettings",
    tokenFormatHint: "API Token from Account Settings",
    scopeFields: ["pages", "dateRange"], permissions: ["readonly"],
  },
  {
    id: "github", name: "GitHub",
    description: "Import issues, PRs, discussions, and commit messages. Trace requirements to code.",
    category: "Code & DevOps", icon: GitBranch, color: "#8B949E",
    docsUrl: "https://docs.github.com/en/rest", tokenPageUrl: "https://github.com/settings/tokens",
    tokenFormatHint: "Personal Access Token (ghp_... or classic)",
    scopeFields: ["repos", "labels", "dateRange", "includeComments"], permissions: ["repo", "read:org"],
  },
  {
    id: "gitlab", name: "GitLab",
    description: "Sync issues, merge requests, and CI/CD pipelines. Import project wikis.",
    category: "Code & DevOps", icon: GitBranch, color: "#FC6D26",
    docsUrl: "https://docs.gitlab.com/ee/api",
    tokenPageUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
    tokenFormatHint: "Personal Access Token (glpat-...)",
    scopeFields: ["repos", "labels", "dateRange", "includeComments"], permissions: ["read_api"],
  },
  {
    id: "bitbucket", name: "Bitbucket",
    description: "Import repositories, PRs, and pipeline data from Bitbucket Cloud.",
    category: "Code & DevOps", icon: GitBranch, color: "#0052CC",
    docsUrl: "https://developer.atlassian.com/cloud/bitbucket",
    tokenPageUrl: "https://bitbucket.org/account/settings/app-passwords/",
    tokenFormatHint: "username|app_password",
    scopeFields: ["repos", "dateRange", "includeComments"], permissions: ["repository"],
  },
  {
    id: "figma", name: "Figma",
    description: "Import design files, components, and comments for visual requirement extraction.",
    category: "Design", icon: Figma, color: "#F24E1E",
    docsUrl: "https://www.figma.com/developers/api",
    tokenPageUrl: "https://www.figma.com/developers/api#access-tokens",
    tokenFormatHint: "Personal Access Token from Figma Settings",
    scopeFields: ["projects", "includeComments"], permissions: ["file_read"],
  },
  {
    id: "google_drive", name: "Google Drive",
    description: "Sync folders and files. Auto-extract content from docs, sheets, and presentations.",
    category: "Cloud Storage", icon: Cloud, color: "#34A853",
    docsUrl: "https://developers.google.com/drive/api",
    tokenPageUrl: "https://console.cloud.google.com/apis/credentials",
    tokenFormatHint: "OAuth 2.0 Access Token",
    scopeFields: ["folders", "dateRange", "includeAttachments"], permissions: ["drive.readonly"],
  },
  {
    id: "dropbox", name: "Dropbox",
    description: "Import files and shared folders. Extract text content for BRD enrichment.",
    category: "Cloud Storage", icon: FolderOpen, color: "#0061FF",
    docsUrl: "https://www.dropbox.com/developers/documentation",
    tokenPageUrl: "https://www.dropbox.com/developers/apps",
    tokenFormatHint: "OAuth 2.0 Access Token from App Console",
    scopeFields: ["folders", "dateRange"], permissions: ["files.metadata.read", "files.content.read"],
  },
  {
    id: "onedrive", name: "OneDrive",
    description: "Connect Microsoft 365 file storage. Sync SharePoint document libraries.",
    category: "Cloud Storage", icon: Cloud, color: "#0078D4",
    docsUrl: "https://learn.microsoft.com/en-us/onedrive/developer",
    tokenPageUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    tokenFormatHint: "Microsoft Graph Access Token",
    scopeFields: ["folders", "dateRange"], permissions: ["Files.Read"],
  },
  {
    id: "gmail", name: "Gmail",
    description: "Extract requirements from email threads, client conversations, and decision chains.",
    category: "Email", icon: Mail, color: "#EA4335",
    docsUrl: "https://developers.google.com/gmail/api",
    tokenPageUrl: "https://console.cloud.google.com/apis/credentials",
    tokenFormatHint: "OAuth 2.0 Access Token (Google Cloud Console)",
    scopeFields: ["labels", "dateRange", "includeAttachments"], permissions: ["gmail.readonly"],
  },
  {
    id: "outlook", name: "Outlook",
    description: "Import emails and calendar items from Microsoft 365 for requirement extraction.",
    category: "Email", icon: Mail, color: "#0078D4",
    docsUrl: "https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview",
    tokenPageUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    tokenFormatHint: "Microsoft Graph Access Token",
    scopeFields: ["labels", "dateRange", "includeAttachments"], permissions: ["Mail.Read"],
  },
  {
    id: "zoom", name: "Zoom",
    description: "Transcribe and analyze meeting recordings for requirements and stakeholder concerns.",
    category: "Meetings", icon: Video, color: "#2D8CFF",
    docsUrl: "https://developers.zoom.us/docs/api", tokenPageUrl: "https://marketplace.zoom.us/develop/create",
    tokenFormatHint: "Server-to-Server OAuth Token",
    scopeFields: ["dateRange"], permissions: ["recording:read", "meeting:read"],
  },
  {
    id: "google_meet", name: "Google Meet",
    description: "Import meeting transcripts and recordings for contextual extraction.",
    category: "Meetings", icon: Video, color: "#00897B",
    docsUrl: "https://developers.google.com/meet",
    tokenPageUrl: "https://console.cloud.google.com/apis/credentials",
    tokenFormatHint: "OAuth 2.0 Access Token (Google Cloud Console)",
    scopeFields: ["dateRange"], permissions: ["meetings.space.readonly"],
  },
];

const ALL_CATEGORIES: Category[] = [
  "Communication", "Project Management", "Documentation", "Code & DevOps",
  "Design", "Cloud Storage", "Email", "Meetings",
];

const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  Communication: MessageSquare, "Project Management": Kanban, Documentation: FileText,
  "Code & DevOps": GitBranch, Design: Figma, "Cloud Storage": Cloud, Email: Mail, Meetings: Video,
};

const SCOPE_META: Record<ScopeField, { label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }> = {
  channels: { label: "Channels", icon: Hash, placeholder: "e.g. #product, #engineering" },
  repos: { label: "Repositories", icon: GitBranch, placeholder: "e.g. org/repo-name" },
  projects: { label: "Projects", icon: Kanban, placeholder: "e.g. Project Alpha, Sprint 12" },
  pages: { label: "Pages / Spaces", icon: FileText, placeholder: "e.g. Product Spec, Meeting Notes" },
  folders: { label: "Folders", icon: FolderOpen, placeholder: "e.g. /BRD Sources, /Specs" },
  labels: { label: "Labels / Tags", icon: Tag, placeholder: "e.g. requirement, priority" },
  dateRange: { label: "Date Range", icon: CalendarDays, placeholder: "" },
  includeComments: { label: "Include Comments", icon: MessageCircle, placeholder: "" },
  includeAttachments: { label: "Include Attachments", icon: Paperclip, placeholder: "" },
};

// ─── Connect Modal ────────────────────────────────────────────────────────────
function ConnectModal({
  app, onClose, onConnect, isConnecting,
}: {
  app: AppDefinition; onClose: () => void; onConnect: (token: string) => Promise<void>; isConnecting: boolean;
}) {
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!tokenInput.trim()) { setError("Please enter your API token or access key."); return; }
    setError(null);
    try { await onConnect(tokenInput.trim()); } catch (e: any) { setError(e.message || "Connection failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${app.color}18` }}>
                <app.icon className="w-5 h-5" style={{ color: app.color }} />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold">Connect {app.name}</h2>
                <p className="text-[12px] text-muted-foreground">{app.category}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">1</span>
              <span className="text-[13px] font-semibold">Get your API credentials</span>
            </div>
            <p className="text-[12px] text-muted-foreground ml-8 mb-3">
              Generate an API token or access key from {app.name}'s developer console.
            </p>
            <div className="flex gap-2 ml-8">
              {app.tokenPageUrl && (
                <a href={app.tokenPageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
                  <Key className="w-3.5 h-3.5" /> Open {app.name} Token Page <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                </a>
              )}
              {app.docsUrl && (
                <a href={app.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] border border-border hover:bg-accent transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> API Docs
                </a>
              )}
            </div>
          </div>

          {/* Required Permissions */}
          <div className="ml-8 p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-2 font-medium">Required scopes</p>
            <div className="flex flex-wrap gap-1.5">
              {app.permissions.map((perm) => (
                <span key={perm} className="px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground text-[11px] font-mono">{perm}</span>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">2</span>
              <span className="text-[13px] font-semibold">Enter your token</span>
            </div>
            {app.tokenFormatHint && (
              <p className="text-[11px] text-muted-foreground ml-8 mb-2">
                Format: <code className="px-1.5 py-0.5 bg-muted rounded-md text-[10px] border border-border/50">{app.tokenFormatHint}</code>
              </p>
            )}
            <div className="relative ml-8">
              <input type={showToken ? "text" : "password"} value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder="Paste your API token here..."
                className="w-full text-[13px] rounded-xl border border-border bg-background px-4 py-3 pr-12 placeholder:text-muted-foreground/40 font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                autoFocus
              />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground">
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="ml-8 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[12px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="ml-8 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-[11px] text-muted-foreground">
            <Shield className="w-3.5 h-3.5 shrink-0 text-primary/60" />
            Credentials stored securely. Read-only scopes only. Disconnect anytime.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3 bg-muted/20">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={isConnecting || !tokenInput.trim()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-medium transition-all shadow-sm ${
              isConnecting || !tokenInput.trim()
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}>
            {isConnecting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting...</> : <><Zap className="w-3.5 h-3.5" /> Connect</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Data Control Modal ───────────────────────────────────────────────────────
function DataControlModal({
  app, integration, onClose, onSave, onDisconnect, onPause,
}: {
  app: AppDefinition;
  integration: {
    _id: Id<"integrations">; status: string;
    dataScope?: { channels?: string[]; repos?: string[]; projects?: string[]; pages?: string[]; folders?: string[]; labels?: string[]; dateRange?: { from?: number; to?: number }; includeComments?: boolean; includeAttachments?: boolean };
    lastSyncAt?: number; lastSyncStatus?: string; itemsSynced?: number; credentials?: { scopes?: string[] };
  };
  onClose: () => void; onSave: (scope: Record<string, unknown>) => void; onDisconnect: () => void; onPause: () => void;
}) {
  const scope = integration.dataScope || {};
  const [localScope, setLocalScope] = useState<Record<string, unknown>>({ ...scope });
  const [tagInput, setTagInput] = useState<Record<string, string>>({});

  const updateArrayField = (field: string, values: string[]) => setLocalScope((prev) => ({ ...prev, [field]: values }));
  const addTag = (field: string) => {
    const val = (tagInput[field] || "").trim();
    if (!val) return;
    const arr = ((localScope[field] as string[]) || []);
    if (!arr.includes(val)) updateArrayField(field, [...arr, val]);
    setTagInput((prev) => ({ ...prev, [field]: "" }));
  };
  const removeTag = (field: string, val: string) => {
    updateArrayField(field, ((localScope[field] as string[]) || []).filter((v) => v !== val));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${app.color}18` }}>
              <app.icon className="w-5 h-5" style={{ color: app.color }} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold">{app.name} — Data Control</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  integration.status === "connected" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                  integration.status === "paused" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                  "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    integration.status === "connected" ? "bg-emerald-500" : integration.status === "paused" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  {integration.status}
                </span>
                {integration.lastSyncAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Last sync: {new Date(integration.lastSyncAt).toLocaleDateString()} · {integration.itemsSynced ?? 0} items
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="rounded-xl bg-muted/40 border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-[12px] font-medium">OAuth Permissions (read-only)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {app.permissions.map((p) => (
                <span key={p} className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">{p}</span>
              ))}
            </div>
          </div>

          {app.scopeFields.map((field) => {
            const meta = SCOPE_META[field];
            if (field === "includeComments" || field === "includeAttachments") {
              const checked = (localScope[field] as boolean | undefined) ?? true;
              return (
                <label key={field} className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/20 border border-border/40 cursor-pointer hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <meta.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium">{meta.label}</span>
                  </div>
                  <button type="button" onClick={() => setLocalScope((prev) => ({ ...prev, [field]: !checked }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/25"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </label>
              );
            }
            if (field === "dateRange") {
              const dr = (localScope.dateRange as { from?: number; to?: number }) || {};
              return (
                <div key={field} className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <meta.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[13px] font-semibold">{meta.label}</span>
                  </div>
                  <div className="flex gap-3 ml-7">
                    <div className="flex-1">
                      <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
                      <input type="date" className="w-full text-[12px] rounded-xl border border-border bg-background px-3 py-2"
                        value={dr.from ? new Date(dr.from).toISOString().split("T")[0] : ""}
                        onChange={(e) => { const ts = e.target.value ? new Date(e.target.value).getTime() : undefined; setLocalScope((prev) => ({ ...prev, dateRange: { ...(prev.dateRange as object || {}), from: ts } })); }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-muted-foreground mb-1 block">To</label>
                      <input type="date" className="w-full text-[12px] rounded-xl border border-border bg-background px-3 py-2"
                        value={dr.to ? new Date(dr.to).toISOString().split("T")[0] : ""}
                        onChange={(e) => { const ts = e.target.value ? new Date(e.target.value).getTime() : undefined; setLocalScope((prev) => ({ ...prev, dateRange: { ...(prev.dateRange as object || {}), to: ts } })); }}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            const items = (localScope[field] as string[]) || [];
            return (
              <div key={field} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <meta.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[13px] font-semibold">{meta.label}</span>
                  {items.length > 0 && <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">{items.length}</span>}
                </div>
                {items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-7">
                    {items.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[12px] font-medium">
                        {item}
                        <button type="button" onClick={() => removeTag(field, item)} className="hover:text-red-500 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 ml-7">
                  <input type="text" placeholder={meta.placeholder} value={tagInput[field] || ""}
                    className="flex-1 text-[12px] rounded-xl border border-border bg-background px-3 py-2 placeholder:text-muted-foreground/40"
                    onChange={(e) => setTagInput((prev) => ({ ...prev, [field]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(field); } }}
                  />
                  <button type="button" onClick={() => addTag(field)} className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors">Add</button>
                </div>
                {items.length === 0 && <p className="text-[11px] text-muted-foreground ml-7">No filter — all {meta.label.toLowerCase()} will be synced</p>}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <button onClick={onPause} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] border border-border hover:bg-accent transition-all">
              {integration.status === "paused" ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
            </button>
            <button onClick={onDisconnect} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
          <button onClick={() => onSave(localScope)} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-all shadow-sm">
            Save Scope
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function IntegrationsView() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<"All" | Category>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [configuringAppId, setConfiguringAppId] = useState<string | null>(null);
  const [connectingAppId, setConnectingAppId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const integrations = useQuery(api.integrations.list, {}) || [];
  const projects = useQuery(api.projects.list) || [];

  const connectMut = useMutation(api.integrations.connect);
  const disconnectMut = useMutation(api.integrations.disconnect);
  const updateScopeMut = useMutation(api.integrations.updateScope);
  const togglePauseMut = useMutation(api.integrations.togglePause);
  const syncAllAction = useAction(api.integrationSync.syncAllToProject);

  const [syncingProject, setSyncingProject] = useState<string | null>(null);

  const handleSyncToProject = useCallback(async (projectId: Id<"projects">) => {
    setSyncingProject(projectId);
    try { await syncAllAction({ projectId }); } catch (e) { console.error("Sync failed:", e); } finally { setSyncingProject(null); }
  }, [syncAllAction]);

  const integrationMap = useMemo(() => {
    const m = new Map<string, (typeof integrations)[number]>();
    for (const i of integrations) m.set(i.appId, i);
    return m;
  }, [integrations]);

  const connectedApps = useMemo(() => {
    return APP_CATALOG.filter((app) => {
      const intg = integrationMap.get(app.id);
      return intg && (intg.status === "connected" || intg.status === "paused");
    });
  }, [integrationMap]);

  const connectedCount = connectedApps.length;

  const filteredApps = useMemo(() => {
    return APP_CATALOG.filter((app) => {
      const catMatch = activeCategory === "All" || app.category === activeCategory;
      const searchMatch = !searchQuery ||
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.category.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && searchMatch;
    });
  }, [activeCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) counts[cat] = APP_CATALOG.filter((a) => a.category === cat).length;
    return counts;
  }, []);

  const handleConnect = useCallback(async (appId: string, accessToken: string) => {
    setConnectingId(appId);
    setConnectError(null);
    try {
      const app = APP_CATALOG.find((a) => a.id === appId);
      const preview = accessToken.length > 12 ? accessToken.slice(0, 8) + "..." + accessToken.slice(-4) : "***";
      await connectMut({
        appId, label: app?.name,
        credentials: { accessToken, tokenPreview: preview, scopes: app?.permissions || [], expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, connectionMethod: "api_token" },
        dataScope: { includeComments: true, includeAttachments: true },
      });
      setConnectingAppId(null);
    } catch (e: any) {
      console.error("Connect failed:", e);
      setConnectError(`Failed to connect ${appId}: ${e.message || "Unknown error"}`);
      throw e;
    } finally { setConnectingId(null); }
  }, [connectMut]);

  const handleDisconnect = useCallback(async (integrationId: Id<"integrations">) => {
    await disconnectMut({ integrationId }); setConfiguringAppId(null);
  }, [disconnectMut]);

  const handleSaveScope = useCallback(async (integrationId: Id<"integrations">, scope: Record<string, unknown>) => {
    await updateScopeMut({ integrationId, dataScope: scope as Parameters<typeof updateScopeMut>[0]["dataScope"] }); setConfiguringAppId(null);
  }, [updateScopeMut]);

  const handleTogglePause = useCallback(async (integrationId: Id<"integrations">) => {
    await togglePauseMut({ integrationId });
  }, [togglePauseMut]);

  const configuringApp = configuringAppId ? APP_CATALOG.find((a) => a.id === configuringAppId) : null;
  const configuringIntegration = configuringAppId ? integrationMap.get(configuringAppId) : null;
  const connectingApp = connectingAppId ? APP_CATALOG.find((a) => a.id === connectingAppId) : null;

  return (
    <div className="max-w-[1120px] mx-auto px-6 lg:px-10 py-8 lg:py-10">

      {/* ─── Page Header ───────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center shadow-sm shrink-0">
            <Cable className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-[28px] tracking-[-0.03em] font-bold leading-tight">Integrations</h1>
            <p className="text-[14px] text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Connect your tools to automatically ingest data into the BRD pipeline. All connections use read-only API scopes.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mt-5">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[14px] font-semibold">{connectedCount}</span>
            <span className="text-[13px] text-muted-foreground">connected</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            <span className="text-[14px] font-semibold">{APP_CATALOG.length}</span>
            <span className="text-[13px] text-muted-foreground">available</span>
          </div>
          {connectedCount > 0 && projects.length > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                <span className="text-[13px] text-muted-foreground">Ready to sync</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Connected Apps (Prominent Section) ────────────────────────── */}
      {connectedApps.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h2 className="text-[17px] font-semibold">Connected Apps</h2>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-medium">{connectedCount} active</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedApps.map((app) => {
              const integration = integrationMap.get(app.id)!;
              const isPaused = integration.status === "paused";
              return (
                <div key={app.id}
                  className={`group relative rounded-2xl border bg-card p-5 transition-all duration-200 hover:shadow-lg cursor-pointer ${
                    isPaused ? "border-amber-500/20 opacity-80" : "border-emerald-500/20 hover:border-emerald-500/40"
                  }`}
                  onClick={() => setConfiguringAppId(app.id)}
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: `${app.color}15` }}>
                      <app.icon className="w-5 h-5" style={{ color: app.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold truncate">{app.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                          isPaused ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isPaused ? <><Pause className="w-2.5 h-2.5" /> Paused</> : <><CheckCircle2 className="w-2.5 h-2.5" /> Live</>}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{app.category}</p>
                    </div>
                  </div>

                  {/* Scope pills */}
                  {integration.dataScope && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Object.entries(integration.dataScope).map(([key, val]) => {
                        if (!val || (Array.isArray(val) && val.length === 0)) return null;
                        if (typeof val === "boolean" && !val) return null;
                        const meta = SCOPE_META[key as ScopeField];
                        if (!meta) return null;
                        return (
                          <span key={key} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-medium">
                            {Array.isArray(val) ? `${val.length} ${meta.label.toLowerCase()}` : meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Sync info */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground">
                      {integration.lastSyncAt ? `${integration.itemsSynced ?? 0} items synced` : "Not synced yet"}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Configure <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Sync to Project Banner ────────────────────────────────────── */}
      {connectedCount > 0 && projects.length > 0 && (
        <section className="mb-10">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] via-violet-500/[0.02] to-transparent p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">Sync to Project</h3>
                <p className="text-[12px] text-muted-foreground">Pull data from {connectedCount} connected app{connectedCount > 1 ? "s" : ""} into a project's sources</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {projects.map((project) => (
                <button key={project._id} onClick={() => handleSyncToProject(project._id)} disabled={syncingProject !== null}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] border transition-all ${
                    syncingProject === project._id
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                  }`}>
                  {syncingProject === project._id ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <Database className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="font-medium">{project.name}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Search + Category Filter ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input type="text" placeholder="Search integrations..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[13px] rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveCategory("All")}
            className={`px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
              activeCategory === "All" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
            All ({APP_CATALOG.length})
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  activeCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <CatIcon className="w-3.5 h-3.5" /> {cat} ({categoryCounts[cat]})
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── How It Works ──────────────────────────────────────────────── */}
      <div className="bg-muted/30 border border-border/60 rounded-2xl px-5 py-4 mb-8">
        <p className="text-[13px] text-foreground/70 leading-relaxed">
          <strong className="text-foreground">How it works:</strong> Click <strong>Connect</strong> to enter your API token for each app.
          Tokens are used with <strong>read-only scopes</strong> to pull data into the BRD pipeline. Configure exactly what data gets synced per integration.
        </p>
      </div>

      {/* Error banner */}
      {connectError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-[13px] text-red-600 dark:text-red-400">{connectError}</p>
          </div>
          <button onClick={() => setConnectError(null)} className="text-red-400 hover:text-red-600 shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ─── App Grid ──────────────────────────────────────────────────── */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-[14px]">No integrations match &ldquo;{searchQuery}&rdquo;</p>
          <button onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
            className="text-[13px] text-primary hover:underline mt-2">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {filteredApps.map((app) => {
            const integration = integrationMap.get(app.id);
            const isConnected = integration?.status === "connected" || integration?.status === "paused";
            const isConnecting = connectingId === app.id;

            return (
              <div key={app.id}
                className={`group rounded-2xl border bg-card transition-all duration-200 overflow-hidden ${
                  isConnected
                    ? "border-emerald-500/15 ring-1 ring-emerald-500/5"
                    : "border-border/60 hover:border-primary/20 hover:shadow-md"
                }`}>
                {/* Card body */}
                <div className="p-5">
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${app.color}12` }}>
                      <app.icon className="w-5 h-5" style={{ color: app.color }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3 className="text-[15px] font-semibold truncate text-foreground">{app.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{app.category}</span>
                    </div>
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-4 min-h-[36px]">
                    {app.description}
                  </p>

                  {/* Scope summary for connected */}
                  {isConnected && integration?.dataScope && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Object.entries(integration.dataScope).map(([key, val]) => {
                        if (!val || (Array.isArray(val) && val.length === 0)) return null;
                        if (typeof val === "boolean" && !val) return null;
                        const meta = SCOPE_META[key as ScopeField];
                        if (!meta) return null;
                        return (
                          <span key={key} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-medium">
                            {Array.isArray(val) ? `${val.length} ${meta.label.toLowerCase()}` : meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="px-5 pb-4 flex items-center gap-2">
                  {app.docsUrl && (
                    <a href={app.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <div className="flex-1" />
                  {isConnected ? (
                    <button onClick={() => setConfiguringAppId(app.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                      <Settings2 className="w-3.5 h-3.5" /> Configure
                    </button>
                  ) : (
                    <button onClick={() => setConnectingAppId(app.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                      <Zap className="w-3.5 h-3.5" /> Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Extraction Pipeline ───────────────────────────────────────── */}
      {activeCategory === "All" && (
        <section className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="text-[17px] font-semibold">Extraction Pipeline</h2>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-medium">9 agents active</span>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.03] to-violet-500/[0.02] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: "Orchestrator", desc: "Pipeline coordination", icon: Crosshair, color: "text-primary" },
                { name: "Ingestion", desc: "Source parsing & extraction", icon: Database, color: "text-amber-500" },
                { name: "Classification", desc: "Type & relevance scoring", icon: GitBranch, color: "text-violet-500" },
                { name: "Requirement", desc: "Requirement extraction", icon: FileText, color: "text-blue-500" },
                { name: "Stakeholder", desc: "People & influence mapping", icon: Users, color: "text-emerald-500" },
                { name: "Decision", desc: "Decision & rationale analysis", icon: Zap, color: "text-orange-500" },
                { name: "Timeline", desc: "Temporal & milestone mapping", icon: Clock, color: "text-cyan-500" },
                { name: "Conflict", desc: "Contradiction detection", icon: AlertTriangle, color: "text-red-500" },
                { name: "Traceability", desc: "Knowledge graph links", icon: Network, color: "text-pink-500" },
              ].map((agent) => (
                <div key={agent.name} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/50 border border-border/30">
                  <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <agent.icon className={`w-4 h-4 ${agent.color}`} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Footer note ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-muted/20 border border-border/50 p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-[13px] font-medium text-muted-foreground">Security & Privacy</span>
        </div>
        <p className="text-[12px] text-muted-foreground/80 leading-relaxed max-w-lg mx-auto">
          All connections use <strong>read-only API scopes</strong>. Credentials are stored securely and never shared.
          You control exactly what data gets pulled via per-integration scope settings.
        </p>
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────── */}
      {connectingApp && (
        <ConnectModal app={connectingApp} onClose={() => setConnectingAppId(null)}
          onConnect={(token) => handleConnect(connectingApp.id, token)}
          isConnecting={connectingId === connectingApp.id}
        />
      )}
      {configuringApp && configuringIntegration && (
        <DataControlModal app={configuringApp} integration={configuringIntegration}
          onClose={() => setConfiguringAppId(null)}
          onSave={(scope) => handleSaveScope(configuringIntegration._id, scope)}
          onDisconnect={() => handleDisconnect(configuringIntegration._id)}
          onPause={() => handleTogglePause(configuringIntegration._id)}
        />
      )}
    </div>
  );
}
