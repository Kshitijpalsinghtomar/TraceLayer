"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * copilot.ts — Global AI Copilot Backend
 *
 * Unlike chatAction.ts (project-specific), this action serves
 * the global floating AI copilot accessible from every page.
 *
 * It aggregates cross-project context and provides system-wide
 * intelligence: answering questions about any project, providing
 * guidance on the platform, and offering proactive recommendations.
 *
 * Provider and API key are resolved from centralized admin config.
 */

export const globalChat = action({
  args: {
    userMessage: v.string(),
    context: v.optional(
      v.object({
        currentPage: v.optional(v.string()),
        activeProjectId: v.optional(v.string()),
        conversationHistory: v.optional(v.array(v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }))),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ response: string }> => {
    const { userMessage, context } = args;

    // ─── Resolve AI config from admin settings ───────────────────────────
    const aiConfig = await ctx.runQuery(api.aiConfig.getAIConfig);
    if (!aiConfig?.configured) {
      throw new Error("No AI provider configured. Ask your admin to set up an API key in the Admin Panel.");
    }

    const settings = await ctx.runQuery(api.settings.getAll);
    const defaultProvider = settings["default_provider"] || aiConfig.provider;

    const apiKey = await ctx.runQuery(api.apiKeys.getKeyForProvider, {
      provider: defaultProvider as any,
    });
    if (!apiKey) {
      throw new Error(`No API key found for provider "${defaultProvider}". Configure one in the Admin Panel.`);
    }

    const provider = defaultProvider as "openai" | "gemini" | "anthropic" | "openrouter";
    const model = aiConfig.model;

    // ─── Gather cross-project context ─────────────────────────────────
    const projects: any[] = await ctx.runQuery(api.projects.list);
    const stats: any = await ctx.runQuery(api.projects.getStats);

    // Build a lightweight overview of all projects
    const projectOverviews = projects.slice(0, 8).map((p: any) => ({
      name: p.name,
      status: p.status,
      description: p.description?.substring(0, 150) || "",
      sources: p.sourcesCount || 0,
      requirements: p.requirementsCount || 0,
      stakeholders: p.stakeholdersCount || 0,
      conflicts: p.conflictsCount || 0,
      decisions: p.decisionsCount || 0,
    }));

    // If user is viewing a specific project, get deeper context
    let activeProjectContext = "";
    if (context?.activeProjectId) {
      try {
        const proj = projects.find((p: any) => p._id === context.activeProjectId);
        if (proj) {
          activeProjectContext = `
## Currently Viewing Project: ${proj.name}
Status: ${proj.status}
Description: ${proj.description || "No description"}
Sources: ${proj.sourcesCount || 0} | Requirements: ${proj.requirementsCount || 0} | Stakeholders: ${proj.stakeholdersCount || 0}
Conflicts: ${proj.conflictsCount || 0} | Decisions: ${proj.decisionsCount || 0}`;
        }
      } catch {
        // Project ID may not be valid
      }
    }

    // Conversation history for continuity
    const historyStr = (context?.conversationHistory || [])
      .slice(-6)
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 300)}`)
      .join("\n");

    const pageContext = context?.currentPage
      ? `The user is currently on the "${context.currentPage}" page.`
      : "";

    const systemPrompt = `You are **TraceLayer Copilot** — the global AI assistant for the TraceLayer intelligent requirements platform.

## Your Identity
You are NOT a generic chatbot. You are an embedded AI copilot that understands the entire TraceLayer system — every project, every agent, every pipeline run. You provide intelligent guidance, answer questions, and proactively help users.

## Platform Overview
TraceLayer is a multi-agent requirements intelligence platform that:
- Ingests communication artifacts (emails, meeting transcripts, Slack logs, Jira exports)
- Runs a 10-agent AI pipeline to extract structured intelligence
- Generates professional BRD (Business Requirements Documents)
- Provides traceability from source → requirement → stakeholder → decision

## The 10 AI Agents
1. **Orchestrator** — Coordinates the entire pipeline, manages agent handoffs
2. **Ingestion Agent** — Parses documents, extracts text, normalizes formats
3. **Classification Agent** — Categorizes content by type and relevance
4. **Requirement Agent** — Extracts structured requirements with evidence chains
5. **Stakeholder Agent** — Identifies people, roles, influence, and sentiment
6. **Decision Agent** — Finds decisions, rationale, and architectural choices
7. **Timeline Agent** — Detects deadlines, milestones, temporal dependencies
8. **Conflict Agent** — Identifies contradictions between requirements
9. **Traceability Agent** — Builds knowledge graph links between entities
10. **Document Agent** — Generates the final BRD with full traceability

## System State
${stats ? `Total across all projects: ${stats.totalProjects || 0} projects, ${stats.totalRequirements || 0} requirements, ${stats.totalSources || 0} sources, ${stats.totalStakeholders || 0} stakeholders` : "No global stats available"}

## Projects
${projectOverviews.length > 0
        ? projectOverviews.map(p => `- **${p.name}** (${p.status}): ${p.sources} sources, ${p.requirements} reqs, ${p.stakeholders} stakeholders${p.conflicts > 0 ? `, ⚠️ ${p.conflicts} conflicts` : ""}`).join("\n")
        : "No projects yet"}
${activeProjectContext}

${pageContext}

## Guidelines
- Be concise, direct, and helpful. Match response length to question complexity.
- Use markdown: **bold**, bullet lists, headers, code blocks as appropriate.
- When you reference specific data, be precise (project names, counts).
- If the user asks about a feature or workflow, explain how it works in TraceLayer.
- If the user seems lost, guide them: suggest what to do next.
- If the user asks about agents, explain which agents handle what and how they coordinate.
- Never fabricate project data. Only reference what's in the context above.
- For complex questions, provide structured responses with clear sections.
- You can suggest running the pipeline, creating projects, or navigating to specific views.

## Recent Conversation
${historyStr}`;

    // ─── Call AI ──────────────────────────────────────────────────────────
    const aiResponse = await callCopilotAI(apiKey, provider, model, systemPrompt, userMessage);

    return { response: aiResponse };
  },
});

// ─── AI Provider Calls ───────────────────────────────────────────────────────
async function callCopilotAI(
  apiKey: string,
  provider: "openai" | "gemini" | "anthropic" | "openrouter",
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 2048,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OpenAI error: ${res.status}`);
    return data.choices[0].message.content;
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: systemPrompt + "\n\n---\n\nUser: " + userPrompt }] },
          ],
          generationConfig: { temperature: 0.35, maxOutputTokens: 2048 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini error: ${res.status}`);
    return data.candidates[0].content.parts[0].text;
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Anthropic error: ${res.status}`);
    return data.content[0].text;
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tracelayer.io",
        "X-Title": "TraceLayer Copilot",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}
