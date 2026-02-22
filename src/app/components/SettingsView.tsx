import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  User,
  Bell,
  Globe,
  ChevronRight,
  ArrowLeft,
  Check,
  Loader2,
  Database,
  Settings,
  Palette,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

type SettingsSection = 'root' | 'profile' | 'notifications' | 'language' | 'data' | 'appearance';

const menuItems = [
  { id: 'profile' as const, icon: User, label: 'Profile', description: 'Name, email, and account details', color: '#6B7AE8' },
  { id: 'appearance' as const, icon: Palette, label: 'Appearance', description: 'Theme, colors, and display', color: '#8B5CF6' },
  { id: 'notifications' as const, icon: Bell, label: 'Notifications', description: 'Extraction and document alerts', color: '#F59E0B' },
  { id: 'language' as const, icon: Globe, label: 'Language & Region', description: 'Display language and time zone', color: '#3B82F6' },
  { id: 'data' as const, icon: Database, label: 'Data & Privacy', description: 'Storage and data management', color: '#10B981' },
];

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-muted'
        }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : ''
          }`}
      />
    </button>
  );
}

const defaultNotifs = {
  requirementExtracted: true,
  brdReady: true,
  stakeholderAdded: false,
  conflictsDetected: true,
  emailDigest: true,
  marketingEmails: false,
};
const defaultLang = { language: 'en-US', timezone: 'America/New_York', dateFormat: 'MM/DD/YYYY' };

export function SettingsView() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>('root');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Theme state — synced with localStorage
  const [currentTheme, setCurrentTheme] = useState<string>(() =>
    localStorage.getItem('tracelayer-theme') || 'light'
  );

  const applyTheme = useCallback((themeId: string) => {
    if (themeId === 'system') {
      localStorage.removeItem('tracelayer-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
      setCurrentTheme('system');
    } else {
      localStorage.setItem('tracelayer-theme', themeId);
      document.documentElement.classList.toggle('dark', themeId === 'dark');
      setCurrentTheme(themeId);
    }
  }, []);

  const allSettings = useQuery(api.settings.getAll);
  const setSetting = useMutation(api.settings.set);

  // Local state hydrated from Convex
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifs);
  const [langPrefs, setLangPrefs] = useState(defaultLang);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from Convex on load
  useEffect(() => {
    if (allSettings && !hydrated) {
      try {
        if (allSettings['notifications']) setNotifPrefs({ ...defaultNotifs, ...JSON.parse(allSettings['notifications']) });
        if (allSettings['language']) setLangPrefs({ ...defaultLang, ...JSON.parse(allSettings['language']) });
      } catch { /* ignore malformed */ }
      setHydrated(true);
    }
  }, [allSettings, hydrated]);

  const handleSave = async (key: string, value: any) => {
    setSaving(true);
    try {
      await setSetting({ key, value: JSON.stringify(value) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save setting:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-10 py-8 max-w-[700px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          {section !== 'root' ? (
            <button
              onClick={() => setSection('root')}
              className="w-9 h-9 rounded-xl hover:bg-accent flex items-center justify-center transition-colors border border-border"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-[28px] tracking-[-0.02em] font-semibold">
              {section === 'root' ? 'Settings' : section === 'appearance' ? 'Appearance' : menuItems.find((m) => m.id === section)?.label}
            </h1>
            {section === 'root' && (
              <p className="text-[15px] text-muted-foreground mt-0.5">
                Manage your account and preferences.
              </p>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Root menu ─────────────────────────────────────── */}
          {section === 'root' && (
            <motion.div
              key="root"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'profile') {
                      navigate('/profile');
                    } else {
                      setSection(item.id);
                    }
                  }}
                  className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-primary/15 transition-all duration-200 text-left group"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}12` }}>
                    <item.icon className="w-[18px] h-[18px]" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-medium group-hover:text-primary transition-colors">{item.label}</p>
                    <p className="text-[13px] text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Notifications ─────────────────────────────────── */}
          {section === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[14px]">In-app notifications</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Choose which events trigger a notification inside TraceLayer
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { key: 'requirementExtracted' as const, label: 'Requirements extracted', description: 'When new requirements are found from a source' },
                    { key: 'brdReady' as const, label: 'BRD ready', description: 'When a BRD or PRD finishes generating' },
                    { key: 'stakeholderAdded' as const, label: 'Stakeholder identified', description: 'When a new stakeholder is detected' },
                    { key: 'conflictsDetected' as const, label: 'Conflicts detected', description: 'When requirements appear to contradict each other' },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="text-[14px]">{label}</p>
                        <p className="text-[12px] text-muted-foreground">{description}</p>
                      </div>
                      <Toggle
                        checked={notifPrefs[key]}
                        onChange={(v) => setNotifPrefs((p) => ({ ...p, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[14px]">Email preferences</p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { key: 'emailDigest' as const, label: 'Weekly digest', description: 'Summary of project activity every Monday' },
                    { key: 'marketingEmails' as const, label: 'Product updates', description: 'New features and announcements from TraceLayer' },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="text-[14px]">{label}</p>
                        <p className="text-[12px] text-muted-foreground">{description}</p>
                      </div>
                      <Toggle
                        checked={notifPrefs[key]}
                        onChange={(v) => setNotifPrefs((p) => ({ ...p, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <SaveButton onSave={() => handleSave('notifications', notifPrefs)} saved={saved} saving={saving} />
            </motion.div>
          )}

          {/* ── Language & Region ─────────────────────────────── */}
          {section === 'language' && (
            <motion.div
              key="language"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
                <div>
                  <label className="text-[13px] text-muted-foreground mb-2 block">Display language</label>
                  <select
                    value={langPrefs.language}
                    onChange={(e) => setLangPrefs((p) => ({ ...p, language: e.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="ja-JP">日本語</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-2 block">Time zone</label>
                  <select
                    value={langPrefs.timezone}
                    onChange={(e) => setLangPrefs((p) => ({ ...p, timezone: e.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
                  >
                    <option value="America/New_York">Eastern Time (UTC-5)</option>
                    <option value="America/Chicago">Central Time (UTC-6)</option>
                    <option value="America/Los_Angeles">Pacific Time (UTC-8)</option>
                    <option value="Europe/London">London (UTC+0)</option>
                    <option value="Europe/Paris">Paris (UTC+1)</option>
                    <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
                    <option value="Asia/Kolkata">India Standard Time (UTC+5:30)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-2 block">Date format</label>
                  <div className="flex gap-2">
                    {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setLangPrefs((p) => ({ ...p, dateFormat: fmt }))}
                        className={`px-3 py-2 rounded-lg border text-[13px] transition-colors ${langPrefs.dateFormat === fmt
                            ? 'border-primary/40 text-primary bg-primary/5'
                            : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                          }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <SaveButton onSave={() => handleSave('language', langPrefs)} saved={saved} saving={saving} />
            </motion.div>
          )}

          {/* ── Data & Privacy ────────────────────────────────── */}
          {section === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[14px] font-medium">Data Storage</p>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    All project data, extracted requirements, and generated documents are stored in your Convex cloud backend.
                    Data is encrypted in transit and at rest.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-[12px] text-muted-foreground">Backend</p>
                      <p className="text-[14px] mt-1 font-medium">Convex Cloud</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-[12px] text-muted-foreground">Region</p>
                      <p className="text-[14px] mt-1 font-medium">EU (Ireland)</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[12px] text-muted-foreground">Encryption</p>
                    <p className="text-[14px] mt-1 font-medium">AES-256 at rest, TLS 1.3 in transit</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Appearance ────────────────────────────────── */}
          {section === 'appearance' && (
            <motion.div
              key="appearance"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[14px] font-medium">Theme</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Choose the visual theme for TraceLayer
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Light', icon: Sun, description: 'Soft white with indigo accents' },
                      { id: 'dark', label: 'Dark', icon: Moon, description: 'Deep navy dark theme' },
                      { id: 'system', label: 'System', icon: Monitor, description: 'Follow your OS preference' },
                    ].map((theme) => {
                      const isSelected = currentTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => applyTheme(theme.id)}
                          className={`p-4 rounded-xl border text-center transition-all duration-200 ${
                            isSelected
                              ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20'
                              : 'border-border hover:border-primary/20 hover:bg-accent/30'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                            isSelected ? 'bg-primary/12' : 'bg-muted'
                          }`}>
                            <theme.icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <p className="text-[13px] font-medium mb-0.5">{theme.label}</p>
                          <p className="text-[11px] text-muted-foreground">{theme.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[14px] font-medium">Interface</p>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-[14px]">Ambient background</p>
                      <p className="text-[12px] text-muted-foreground">Subtle gradient mesh behind content</p>
                    </div>
                    <Toggle checked={true} onChange={() => {}} />
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-[14px]">Animations</p>
                      <p className="text-[12px] text-muted-foreground">Page transitions and micro-interactions</p>
                    </div>
                    <Toggle checked={true} onChange={() => {}} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function SaveButton({ onSave, saved, saving }: { onSave: () => void; saved: boolean; saving: boolean }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${saved
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : saving
              ? 'bg-primary/70 text-primary-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            Saved
          </>
        ) : saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </div>
  );
}
