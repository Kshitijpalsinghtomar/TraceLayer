import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useLocation, useParams, useNavigate } from 'react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  HelpCircle,
  Layers,
  Bell,
  Search,
  ChevronRight,
  Puzzle,
  Terminal,
  FileText,
  Network,
  MessageSquare,
  BarChart3,
  Lightbulb,
  FileTerminal,
  SlidersHorizontal,
  Shield,
  AlertTriangle,
  Moon,
  Sun,
} from 'lucide-react';
import { NotificationPanel, useNotificationCount } from './NotificationPanel';
import { UserMenu } from './UserMenu';
import { AICopilot } from './AICopilot';
import { useAdmin } from '../hooks/useAdmin';

// Add Link2 for Document Chain
import { Link2 } from 'lucide-react';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
];

// Configure nav
const getConfigureNav = (_isAdmin: boolean) => [
  { to: '/integrations', icon: Puzzle, label: 'Integrations' },
];

const accountNav = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

// Convex IDs are typically 32-char alphanumeric strings
function looksLikeConvexId(s: string): boolean {
  return /^[a-z0-9]{20,}$/i.test(s);
}

function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  // Extract projectId from URL if it exists (e.g. /projects/:projectId/...)
  const projectIdPart = parts.length >= 2 && parts[0] === 'projects' && looksLikeConvexId(parts[1])
    ? parts[1]
    : null;

  const project = useQuery(
    api.projects.get,
    projectIdPart ? { projectId: projectIdPart as Id<"projects"> } : "skip"
  );

  if (parts.length === 0) return null;

  const labels: Record<string, string> = {
    projects: 'Projects',
    new: 'New Project',
    upload: 'Upload',
    processing: 'Processing',
    pipeline: 'Pipeline',
    brd: 'BRD',
    prd: 'PRD',
    graph: 'Knowledge Graph',
    settings: 'Settings',
    help: 'Help',
    integrations: 'Integrations',
    'ai-settings': 'AI Settings',
    profile: 'Profile',
    search: 'Search',
    controls: 'Control Center',
    admin: 'Admin',
    conflicts: 'Conflicts',
  };

  const getLabel = (part: string): string => {
    if (labels[part]) return labels[part];
    if (looksLikeConvexId(part) && project?.name) return project.name;
    if (looksLikeConvexId(part)) return 'Project';
    return part;
  };

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <NavLink to="/" className="hover:text-foreground transition-colors">
        Home
      </NavLink>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" />
          <span className={i === parts.length - 1 ? 'text-foreground' : ''}>
            {getLabel(part)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Layout() {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useNotificationCount();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  // ─── Dark mode state (persisted in localStorage) ───────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('tracelayer-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tracelayer-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => setIsDarkMode((v) => !v), []);

  // Note: First-visit redirect removed — AuthGuard now handles unauthenticated users

  // Detect if we're inside a project
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;
  const isInsideProject = !!projectId && projectId !== 'new';
  const currentProject = useQuery(
    api.projects.get,
    isInsideProject ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // ─── Recent project persistence ────────────────────────────────────────
  const [recentProject, setRecentProject] = useState<{ id: string; name: string; color: string } | null>(() => {
    try {
      const stored = localStorage.getItem('tracelayer-recent-project');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Save the current project as recent whenever we visit one
  useEffect(() => {
    if (isInsideProject && currentProject && projectId) {
      const entry = { id: projectId, name: currentProject.name, color: currentProject.color };
      setRecentProject(entry);
      localStorage.setItem('tracelayer-recent-project', JSON.stringify(entry));
    }
  }, [isInsideProject, currentProject, projectId]);

  const configureNav = getConfigureNav(isAdmin);

  // ─── Integration stats for sidebar CTA ─────────────────────────────────
  const integrationStats = useQuery(api.integrations.getConnectedCount, isInsideProject ? { projectId: projectId as Id<"projects"> } : {});

  // ─── Inline search state ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const recentSearches: string[] = (() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })();

  const quickLinks = [
    { label: 'Projects', path: '/projects' },
    { label: 'Integrations', path: '/integrations' },
    { label: 'Settings', path: '/settings' },
    { label: 'Help', path: '/help' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    if (searchFocused) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchFocused]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      // Save to recent
      const existing: string[] = (() => { try { return JSON.parse(localStorage.getItem('recentSearches') || '[]'); } catch { return []; } })();
      const updated = [searchQuery.trim(), ...existing.filter(s => s !== searchQuery.trim())].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Skip to content for keyboard users */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col relative overflow-hidden" role="navigation" aria-label="Main navigation">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-primary/[0.01] pointer-events-none" />

        {/* Logo */}
        <div className="relative px-7 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-md shadow-primary/25">
            <Layers className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="text-[18px] tracking-[-0.01em] font-medium" style={{ fontFamily: "'DM Serif Display', serif" }}>
            TraceLayer
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-2 flex flex-col gap-6 overflow-y-auto relative">
          {/* Main */}
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-primary/12 to-primary/8 text-primary font-medium border border-primary/15 shadow-sm shadow-primary/5'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`
                }
              >
                <span>{item.label}</span>
                <item.icon className="w-[18px] h-[18px]" />
              </NavLink>
            ))}
          </div>

          {/* Active Project Navigation */}
          {isInsideProject && currentProject && (
            <div>
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider px-3 mb-1.5">
                Project
              </p>
              <div className="px-3 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentProject.color }} />
                  <span className="text-[13px] font-medium truncate">{currentProject.name}</span>
                </div>
              </div>
              <div className="space-y-0.5">
                {[
                  { to: `/projects/${projectId}`, icon: MessageSquare, label: 'Workspace', end: true },
                  { to: `/projects/${projectId}/chain`, icon: Link2, label: 'Document Chain' },
                  { to: `/projects/${projectId}/brd`, icon: FileText, label: 'BRD Document' },
                  { to: `/projects/${projectId}/graph`, icon: Network, label: 'Knowledge Graph' },
                  { to: `/projects/${projectId}/analytics`, icon: BarChart3, label: 'Analytics' },
                  { to: `/projects/${projectId}/decisions`, icon: Lightbulb, label: 'Decisions' },
                  { to: `/projects/${projectId}/sources`, icon: FileTerminal, label: 'Sources' },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end || false}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${isActive
                        ? 'bg-primary/8 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    <item.icon className="w-[16px] h-[16px]" />
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Recent Project — shown when NOT inside a project */}
          {!isInsideProject && recentProject && (
            <div>
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider px-3 mb-1.5">
                Recent Project
              </p>
              <NavLink
                to={`/projects/${recentProject.id}`}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 hover:bg-accent/60 group"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: recentProject.color }} />
                <span className="font-medium truncate text-foreground/80 group-hover:text-foreground">{recentProject.name}</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
              </NavLink>
              <div className="space-y-0.5 mt-1">
                {[
                  { to: `/projects/${recentProject.id}`, icon: MessageSquare, label: 'Workspace', end: true },
                  { to: `/projects/${recentProject.id}/brd`, icon: FileText, label: 'BRD Document' },
                  { to: `/projects/${recentProject.id}/graph`, icon: Network, label: 'Knowledge Graph' },
                  { to: `/projects/${recentProject.id}/analytics`, icon: BarChart3, label: 'Analytics' },
                  { to: `/projects/${recentProject.id}/conflicts`, icon: AlertTriangle, label: 'Conflicts' },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end || false}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 transition-all duration-150"
                  >
                    <span>{item.label}</span>
                    <item.icon className="w-[14px] h-[14px]" />
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Configure */}
          <div>
            <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider px-3 mb-1.5">
              Configure
            </p>
            <div className="space-y-0.5">
              {configureNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-all duration-150 ${isActive
                      ? 'bg-primary/8 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  <item.icon className="w-[18px] h-[18px]" />
                </NavLink>
              ))}
            </div>
          </div>

          {/* Account */}
          <div>
            <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider px-3 mb-1.5">
              Account
            </p>
            <div className="space-y-0.5">
              {accountNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-all duration-150 ${isActive
                      ? 'bg-primary/8 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  <item.icon className="w-[18px] h-[18px]" />
                </NavLink>
              ))}
              {/* Admin link — only visible for admin-role users */}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-all duration-150 ${isActive
                      ? 'bg-primary/8 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`
                  }
                >
                  <span>Admin Panel</span>
                  <Shield className="w-[18px] h-[18px]" />
                </NavLink>
              )}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-4 pb-5 relative">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-violet-500/8 to-indigo-500/12 border border-primary/12 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                <Puzzle className="w-3 h-3 text-primary" />
              </div>
              <p className="text-[12px] font-semibold text-primary">
                {integrationStats
                  ? `${integrationStats.connected} of ${integrationStats.total} Connected`
                  : 'Integrations'}
              </p>
            </div>
            <p className="text-[11px] text-foreground/60 leading-relaxed">
              {integrationStats && integrationStats.connected > 0
                ? `${integrationStats.connected} integration${integrationStats.connected !== 1 ? 's' : ''} active. Connect more for richer BRD extraction.`
                : 'Connect Slack, GitHub, Jira, Gmail & more for automated extraction.'}
            </p>
            <button onClick={() => navigate(isInsideProject ? `/projects/${projectId}/integrations` : '/integrations')} className="mt-3 text-[12px] text-primary font-medium hover:underline flex items-center gap-1 group">
              {integrationStats && integrationStats.connected > 0 ? 'Manage integrations' : 'Set up integrations'}
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" role="main">
        {/* Top bar */}
        <header className="h-[60px] shrink-0 border-b border-border/60 flex items-center px-8 gap-4 bg-card/50 backdrop-blur-md relative z-50" role="banner">
          <div className="flex-1">
            <Breadcrumbs />
          </div>

          {/* Global search with inline dropdown */}
          <div className="relative w-[260px]" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
                if (e.key === 'Escape') { setSearchFocused(false); searchInputRef.current?.blur(); }
              }}
              placeholder="Search TraceLayer..."
              className="w-full pl-9 pr-3 py-1.5 bg-muted/40 dark:bg-muted/30 border border-border/50 rounded-lg text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
            />
            {/* Dropdown */}
            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {searchQuery.trim() ? (
                  <button
                    onClick={handleSearchSubmit}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    Search for &ldquo;{searchQuery.trim()}&rdquo;
                    <span className="ml-auto text-[11px] text-muted-foreground/60">Enter &crarr;</span>
                  </button>
                ) : null}
                {!searchQuery.trim() && recentSearches.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 pt-2.5 pb-1">Recent Searches</p>
                    {recentSearches.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          navigate(`/search?q=${encodeURIComponent(s)}`);
                          setSearchFocused(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Search className="w-3 h-3" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-border/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 pt-2.5 pb-1">Quick Navigation</p>
                  {quickLinks.map((link) => (
                    <button
                      key={link.path}
                      onClick={() => { navigate(link.path); setSearchFocused(false); setSearchQuery(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="w-3 h-3" />
                      {link.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border/50">
                  <button
                    onClick={() => { navigate('/search'); setSearchFocused(false); }}
                    className="w-full px-3 py-2 text-[11px] text-primary hover:bg-accent transition-colors text-center"
                  >
                    Advanced Search &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg hover:bg-accent/60 flex items-center justify-center transition-colors"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? (
                <Sun className="w-[18px] h-[18px] text-muted-foreground" />
              ) : (
                <Moon className="w-[18px] h-[18px] text-muted-foreground" />
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => { setNotifOpen((v) => !v); }}
              className="w-8 h-8 rounded-lg hover:bg-accent/60 flex items-center justify-center transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-[18px] h-[18px] text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
              )}
            </button>

            <UserMenu onThemeToggle={toggleTheme} isDarkMode={isDarkMode} />
          </div>
        </header>

        {/* Page content */}
        <div id="main-content" className="flex-1 overflow-y-auto ambient-bg" role="region" aria-label="Page content">
          <Outlet />
        </div>
      </main>

      {/* Global overlays */}
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />

      {/* Global AI Copilot — accessible from every page */}
      <AICopilot />
    </div>
  );
}