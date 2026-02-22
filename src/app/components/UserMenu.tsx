import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Loader2,
  Moon,
  Sun,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserMenuProps {
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
}

export function UserMenu({ onThemeToggle, isDarkMode }: UserMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  // Get user info from settings
  const settings = useQuery(api.settings.getAll);
  const setSetting = useMutation(api.settings.set);

  const [saving, setSaving] = useState(false);

  const profile = settings?.['profile']
    ? JSON.parse(settings['profile'])
    : { name: 'TraceLayer User', email: '' };

  const userInitials = profile.name
    ? profile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'TL';

  // Calculate dropdown position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const menuItems = [
    {
      icon: User,
      label: 'Profile',
      description: 'View and edit your profile',
      onClick: () => { setOpen(false); navigate('/profile'); }
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Notifications & preferences',
      onClick: () => { setOpen(false); navigate('/settings'); }
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      description: 'FAQs and contact',
      onClick: () => { setOpen(false); navigate('/help'); }
    },
  ];

  const dropdown = open ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="fixed w-72 bg-popover border border-border rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
      >
        {/* User info header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[14px] text-primary font-medium shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-popover-foreground truncate">{profile.name || 'User'}</p>
              <p className="text-[12px] text-muted-foreground truncate">{profile.email || 'No email set'}</p>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-popover-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Sign out */}
        <div className="px-4 py-2 border-t border-border">
          <button
            onClick={() => { setOpen(false); navigate('/'); }}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-left text-destructive"
          >
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-[13px]">Sign out</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] text-primary font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : userInitials}
        </div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </>
  );
}
