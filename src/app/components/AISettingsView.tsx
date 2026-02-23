/**
 * AISettingsView — Convex-connected API key management and AI provider configuration
 */
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { motion } from "motion/react";
import { useAdmin } from "../hooks/useAdmin";
import { useNavigate } from "react-router";
import {
  Layers,
  Cpu,
  Key,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Zap,
  Lock,
  FlaskConical,
  AlertCircle,
} from "lucide-react";

const PROVIDERS = [
  {
    id: "openai" as const,
    name: "OpenAI",
    icon: Sparkles,
    description: "GPT-4o — Best accuracy for requirement extraction",
    badge: "Recommended",
    badgeColor: "bg-primary/10 text-primary",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini" as const,
    name: "Google Gemini",
    icon: Zap,
    description: "Gemini 2.0 Flash — Fast and cost-effective, great for large documents",
    badge: "Fast",
    badgeColor: "bg-blue-100 text-blue-700",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "anthropic" as const,
    name: "Anthropic",
    icon: Cpu,
    description: "Claude 3.5 Sonnet — Excellent at structured data extraction",
    badge: "Precise",
    badgeColor: "bg-purple-100 text-purple-700",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
];

export function AISettingsView() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const activeKeys = useQuery(api.apiKeys.getActiveKeys);
  const storeKey = useMutation(api.apiKeys.storeKey);
  const deleteKey = useMutation(api.apiKeys.deleteKey);
  const testKeyAction = useAction(api.apiKeys.testKey);

  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  if (!isAdmin) {
    return (
      <div className="px-10 py-20 max-w-[480px] mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-[20px] font-semibold mb-2">Admin Access Required</h2>
        <p className="text-[14px] text-muted-foreground mb-6">API key management is restricted to administrators.</p>
        <button
          onClick={() => navigate("/admin")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          Go to Admin Panel
        </button>
      </div>
    );
  }

  const handleSaveKey = async (provider: "openai" | "gemini" | "anthropic") => {
    const key = newKeys[provider]?.trim();
    if (!key) return;
    setSaving((p) => ({ ...p, [provider]: true }));
    setSaveErrors((p) => ({ ...p, [provider]: "" }));
    try {
      await storeKey({ provider, key });
      setNewKeys((p) => ({ ...p, [provider]: "" }));
      setTestResults((p) => ({ ...p, [provider]: undefined as any }));
    } catch (err: any) {
      setSaveErrors((p) => ({ ...p, [provider]: err.message || "Failed to save key" }));
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleTestKey = async (provider: "openai" | "gemini" | "anthropic") => {
    const key = newKeys[provider]?.trim();
    if (!key) return;
    setTesting((p) => ({ ...p, [provider]: true }));
    setTestResults((p) => ({ ...p, [provider]: undefined as any }));
    try {
      const result = await testKeyAction({ provider, key });
      setTestResults((p) => ({ ...p, [provider]: result }));
    } catch (err: any) {
      setTestResults((p) => ({ ...p, [provider]: { valid: false, error: err.message } }));
    } finally {
      setTesting((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteKey({ keyId: keyId as any });
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const getActiveKeyForProvider = (provider: string) =>
    (activeKeys || []).find((k) => k.provider === provider);

  return (
    <div className="px-10 py-8 max-w-[720px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-[28px] tracking-[-0.02em] font-semibold">AI Configuration</h1>
        </div>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Configure your AI provider API keys. TraceLayer supports multiple providers —
          you can switch between them when running the extraction pipeline.
        </p>
      </motion.div>

      {/* Security notice */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-emerald-50/50 rounded-2xl border border-emerald-200/50 p-5 flex items-start gap-3 mb-8"
      >
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] text-emerald-800 font-medium mb-1">
            Your keys are stored securely
          </p>
          <p className="text-[13px] text-emerald-700/70 leading-relaxed">
            API keys are base64-encoded before storage and never exposed in client-side code.
            Keys are only used server-side during pipeline execution.
          </p>
        </div>
      </motion.div>

      {/* Provider cards */}
      <div className="space-y-5">
        {PROVIDERS.map((provider, i) => {
          const activeKey = getActiveKeyForProvider(provider.id);
          const Icon = provider.icon;
          const testResult = testResults[provider.id];
          const saveError = saveErrors[provider.id];

          return (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-md hover:border-border/80 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-medium">{provider.name}</h3>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${provider.badgeColor}`}>
                        {provider.badge}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {provider.description}
                    </p>
                  </div>
                </div>

                {activeKey && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[12px] text-emerald-600 font-medium">Active</span>
                  </div>
                )}
              </div>

              {/* Existing key display */}
              {activeKey && (
                <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[13px] font-mono text-muted-foreground">
                      {activeKey.keyPreview}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      added {new Date(activeKey.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(activeKey._id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors group"
                    title="Remove key"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-500" />
                  </button>
                </div>
              )}

              {/* Input for new key */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKeys[provider.id] ? "text" : "password"}
                    value={newKeys[provider.id] || ""}
                    onChange={(e) => {
                      setNewKeys((p) => ({ ...p, [provider.id]: e.target.value }));
                      setSaveErrors((p) => ({ ...p, [provider.id]: "" }));
                      setTestResults((p) => ({ ...p, [provider.id]: undefined as any }));
                    }}
                    placeholder={activeKey ? "Replace key..." : provider.placeholder}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-[14px] font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/8 transition-all pr-10"
                  />
                  <button
                    onClick={() =>
                      setShowKeys((p) => ({
                        ...p,
                        [provider.id]: !p[provider.id],
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKeys[provider.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleTestKey(provider.id)}
                  disabled={!newKeys[provider.id]?.trim() || testing[provider.id]}
                  className="px-4 py-2.5 bg-muted text-foreground rounded-xl text-[13px] hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1.5"
                  title="Test this key against the provider API"
                >
                  {testing[provider.id] ? (
                    <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <FlaskConical className="w-3.5 h-3.5" />
                      Test
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleSaveKey(provider.id)}
                  disabled={!newKeys[provider.id]?.trim() || saving[provider.id]}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {saving[provider.id] ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>

              {/* Test result / error feedback */}
              {testResult && (
                <div className={`mt-3 flex items-center gap-2 text-[12px] ${testResult.valid ? "text-emerald-600" : "text-red-500"}`}>
                  {testResult.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Key is valid — API connection successful</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{testResult.error || "Key validation failed"}</span>
                    </>
                  )}
                </div>
              )}
              {saveError && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Docs link */}
              <p className="mt-3 text-[12px] text-muted-foreground">
                Get your API key from{" "}
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {provider.name} dashboard →
                </a>
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="mt-8 bg-muted/30 rounded-2xl border border-border p-6"
      >
        <h3 className="text-[14px] font-medium mb-3">How it works</h3>
        <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center shrink-0 mt-0.5 text-[11px] text-primary">1</span>
            <p>Add your API key for at least one provider above.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center shrink-0 mt-0.5 text-[11px] text-primary">2</span>
            <p>Use the <strong>Test</strong> button to verify your key connects successfully.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center shrink-0 mt-0.5 text-[11px] text-primary">3</span>
            <p>When running the extraction pipeline, select which provider to use.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center shrink-0 mt-0.5 text-[11px] text-primary">4</span>
            <p>TraceLayer's multi-agent system uses your key to extract requirements, identify stakeholders, detect conflicts, and generate your BRD.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
