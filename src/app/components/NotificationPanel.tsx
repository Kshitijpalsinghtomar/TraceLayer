import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Info, AlertTriangle, Bell } from 'lucide-react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lastNotificationSeenTime';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "ingestion_agent" → "Ingestion Agent" */
function formatAgentName(agent: string): string {
  return agent
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Epoch ms → "just now", "2 min ago", "1 hour ago", etc. */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function mapLevel(level: string): 'success' | 'warning' | 'info' {
  if (level === 'success') return 'success';
  if (level === 'warning' || level === 'error') return 'warning';
  return 'info';
}

/**
 * Filter to only show important notifications — pipeline start/end, BRD generation,
 * errors, and conflict warnings. Skips per-item detail logs (individual requirements,
 * stakeholders, decisions, timeline events) that would otherwise flood the panel.
 */
function isNotificationWorthy(log: { level: string; message: string; agent: string }): boolean {
  // Always surface errors
  if (log.level === 'error') return true;

  // Orchestrator pipeline start & completion
  if (
    log.agent === 'orchestrator' &&
    (log.level === 'success' || log.message.includes('Pipeline started'))
  )
    return true;

  // BRD / document generation complete
  if (log.agent === 'document_agent' && log.level === 'success') return true;

  // Conflict warnings (important for the user to act on)
  if (log.agent === 'conflict_agent' && log.level === 'warning') return true;

  // Everything else is a per-item detail — skip it
  return false;
}

function getLastSeenTime(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function setLastSeenTime(ts: number) {
  localStorage.setItem(STORAGE_KEY, String(ts));
}

// ─── Shared hook for unread count (used by Layout.tsx) ───────────────────────

export function useNotificationCount(): number {
  const logs = useQuery(api.pipeline.getRecentActivity);
  const [lastSeen, setLastSeen] = useState(getLastSeenTime);

  // Re-read localStorage when it changes from other tabs / panel close
  useEffect(() => {
    const onStorage = () => setLastSeen(getLastSeenTime());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Also re-read periodically so the badge updates when the panel is closed
  useEffect(() => {
    const id = setInterval(() => setLastSeen(getLastSeenTime()), 2000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!logs) return 0;
    return logs
      .filter((l) => isNotificationWorthy(l))
      .filter((l) => l.timestamp > lastSeen).length;
  }, [logs, lastSeen]);
}

// ─── Type config ─────────────────────────────────────────────────────────────

const typeConfig = {
  success: { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50' },
  info: { icon: Info, className: 'text-primary bg-primary/8' },
  warning: { icon: AlertTriangle, className: 'text-amber-600 bg-amber-50' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const logs = useQuery(api.pipeline.getRecentActivity);

  // IDs the user has locally dismissed this session
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // The timestamp the user last opened the panel
  const [lastSeen, setLastSeen] = useState(getLastSeenTime);

  // When the panel opens, snapshot lastSeen so the unread dots stay stable
  // while the user is viewing. We'll persist a new time when they close.
  useEffect(() => {
    if (open) {
      setLastSeen(getLastSeenTime());
    }
  }, [open]);

  // Persist "seen" time when the panel closes
  const handleClose = useCallback(() => {
    setLastSeenTime(Date.now());
    onClose();
  }, [onClose]);

  // Build display items — only show notification-worthy logs
  const items = useMemo(() => {
    if (!logs) return [];
    return logs
      .filter((l) => isNotificationWorthy(l))
      .filter((l) => !dismissedIds.has(l._id))
      .map((l) => ({
        id: l._id,
        type: mapLevel(l.level),
        title: formatAgentName(l.agent),
        body: l.message,
        detail: l.detail,
        timestamp: l.timestamp,
        relativeTime: relativeTime(l.timestamp),
        read: l.timestamp <= lastSeen,
        projectId: l.projectId,
      }));
  }, [logs, dismissedIds, lastSeen]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAllRead = useCallback(() => {
    setLastSeenTime(Date.now());
    setLastSeen(Date.now());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleItemClick = useCallback(
    (item: (typeof items)[number]) => {
      if (item.projectId) {
        navigate(`/projects/${item.projectId}`);
        handleClose();
      }
    },
    [navigate, handleClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — semi-transparent with blur to separate layers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 z-[60] bg-black/15 dark:bg-black/30 backdrop-blur-[1px]"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[68px] right-6 w-[380px] z-[70]"
          >
            <div className="bg-card rounded-2xl border border-border shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] overflow-hidden backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-foreground" />
                  <span className="text-[14px]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[11px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[12px] text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/8 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleClose}
                    className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[440px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-[14px] text-muted-foreground">
                      {logs === undefined ? 'Loading…' : "You're all caught up"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {items.map((item) => {
                      const config = typeConfig[item.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={`group flex gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-accent/60 relative ${
                            !item.read ? 'bg-primary/[0.02]' : ''
                          }`}
                        >
                          {!item.read && (
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.className}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] mb-0.5">{item.title}</p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                              {item.body}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                              {item.relativeTime}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismiss(item.id);
                            }}
                            className="w-6 h-6 rounded-md hover:bg-accent flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
