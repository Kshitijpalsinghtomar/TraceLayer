import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  User,
  Mail,
  Briefcase,
  Calendar,
  Camera,
  Save,
  Check,
  Loader2,
  ArrowLeft,
  Shield,
  Clock,
  FileText,
  FolderOpen,
  Settings,
} from 'lucide-react';

const defaultProfile = { 
  name: 'TraceLayer User', 
  email: '', 
  role: 'Product Manager',
  avatar: '',
  bio: '',
};

export function ProfileView() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'security'>('profile');

  const allSettings = useQuery(api.settings.getAll);
  const setSetting = useMutation(api.settings.set);
  
  // Get user activity/stats
  const projects = useQuery(api.projects.list);
  const userActivity = useQuery(api.chat.list);

  // Local state
  const [profile, setProfile] = useState(defaultProfile);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from Convex
  useEffect(() => {
    if (allSettings && !hydrated) {
      try {
        if (allSettings['profile']) {
          setProfile({ ...defaultProfile, ...JSON.parse(allSettings['profile']) });
        }
      } catch { /* ignore malformed */ }
      setHydrated(true);
    }
  }, [allSettings, hydrated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting({ key: 'profile', value: JSON.stringify(profile) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const userInitials = profile.name 
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'TL';

  // Calculate user stats
  const stats = {
    projects: projects?.length || 0,
    messages: userActivity?.length || 0,
    memberSince: 'January 2025',
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'activity' as const, label: 'Activity', icon: Clock },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <div className="px-10 py-8 max-w-[900px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl hover:bg-accent flex items-center justify-center transition-colors border border-border"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-[28px] tracking-[-0.02em] font-semibold">Profile</h1>
            <p className="text-[15px] text-muted-foreground mt-0.5">
              Manage your personal information and account settings.
            </p>
          </div>
        </div>

        {/* Profile header card */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
          {/* Banner gradient */}
          <div className="h-20 bg-gradient-to-r from-primary/15 via-primary/10 to-violet-500/10" />
          <div className="px-8 pb-8 -mt-12">
            <div className="flex items-end gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-[32px] text-primary font-semibold border-4 border-card shadow-lg">
                  {userInitials}
                </div>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* User info */}
              <div className="flex-1 pb-1">
                <h2 className="text-[22px] font-semibold">{profile.name || 'Your Name'}</h2>
                <p className="text-[14px] text-muted-foreground">{profile.role || 'Set your role'} {profile.email ? `· ${profile.email}` : ''}</p>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 shadow-sm ${
                  saved
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : saving
                      ? 'bg-primary/70 text-primary-foreground cursor-wait'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {saved ? (
                  <><Check className="w-4 h-4" /> Saved</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
            
            {/* Quick stats */}
            <div className="flex items-center gap-6 mt-5 pt-5 border-t border-border">
              <div className="flex items-center gap-2 text-[13px]">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><FolderOpen className="w-3.5 h-3.5 text-blue-600" /></div>
                <span className="text-muted-foreground">{stats.projects} Projects</span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-violet-600" /></div>
                <span className="text-muted-foreground">Member since {stats.memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] transition-all ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-6 space-y-6"
          >
            <h3 className="text-[16px] font-semibold mb-4">Personal Information</h3>
            
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'Full Name', key: 'name' as const, placeholder: 'Your full name', icon: User },
                { label: 'Email Address', key: 'email' as const, placeholder: 'your@email.com', icon: Mail },
                { label: 'Job Role', key: 'role' as const, placeholder: 'e.g. Product Manager', icon: Briefcase },
                { label: 'Bio', key: 'bio' as const, placeholder: 'Tell us about yourself...', icon: FileText, isTextarea: true },
              ].map(({ label, key, placeholder, icon: Icon, isTextarea }) => (
                <div key={key} className={isTextarea ? 'col-span-2' : ''}>
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground mb-2">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </label>
                  {isTextarea ? (
                    <textarea
                      value={profile[key] || ''}
                      onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all resize-none"
                    />
                  ) : (
                    <input
                      type={key === 'email' ? 'email' : 'text'}
                      value={profile[key] || ''}
                      onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <h3 className="text-[16px] font-semibold mb-4">Recent Activity</h3>
            
            {userActivity && userActivity.length > 0 ? (
              <div className="space-y-4">
                {userActivity.slice(0, 10).map((activity: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/6 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px]">Chat interaction</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {activity.messages?.[0]?.content?.slice(0, 100) || 'No messages'}
                      </p>
                    </div>
                    <span className="text-[12px] text-muted-foreground shrink-0">
                      {activity._creationTime ? new Date(activity._creationTime).toLocaleDateString() : 'Recently'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[14px] text-muted-foreground">No recent activity</p>
                <p className="text-[13px] text-muted-foreground/70 mt-1">
                  Your chat history and project activity will appear here.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="text-[16px] font-semibold mb-4">Password & Security</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[14px]">Password</p>
                      <p className="text-[12px] text-muted-foreground">Last changed 30 days ago</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="text-[13px] text-primary hover:underline"
                  >
                    Change in Settings
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[14px]">Two-factor authentication</p>
                      <p className="text-[12px] text-muted-foreground">Add an extra layer of security</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="text-[13px] text-primary hover:underline"
                  >
                    Enable
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="text-[16px] font-semibold mb-4">Connected Accounts</h3>
              
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600">G</span>
                  </div>
                  <div>
                    <p className="text-[14px]">Google Account</p>
                    <p className="text-[12px] text-muted-foreground">{profile.email || 'Not connected'}</p>
                  </div>
                </div>
                <button className="text-[13px] text-primary hover:underline">
                  {profile.email ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
