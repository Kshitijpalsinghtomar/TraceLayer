"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Chat Action — The brain of TraceLayer.
 *
 * Sends user prompts to AI with FULL project context including:
 * - Source document content (not just names)
 * - Extracted requirements, stakeholders, decisions
 * - Current BRD content
 * - Chat history
 *
 * The AI can then reason over the actual data, not just metadata.
 */
export const chat = action({
  args: {
    projectId: v.id("projects"),
    userMessage: v.string(),
    provider: v.optional(v.union(
      v.literal("openai"),
      v.literal("gemini"),
      v.literal("anthropic")
    )),
    apiKey: v.optional(v.string()), // deprecated — ignored, resolved server-side
    /** Optional: additional projects to include in AI context (cross-project access) */
    additionalProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (ctx, args): Promise<any> => {
    const { projectId, userMessage, additionalProjectIds } = args;

    // Resolve API key server-side
    const resolved = await ctx.runQuery(internal.apiKeys.resolveProviderAndKey, {
      preferredProvider: args.provider,
    });
    if (!resolved) {
      throw new Error("No API key configured. An admin must configure an AI provider key in Settings.");
    }
    const { provider, apiKey } = resolved;

    // Store user message
    await ctx.runMutation(api.chat.sendMessage, {
      projectId,
      role: "user",
      content: userMessage,
      metadata: { provider },
    });

    // ─── Helper: gather context for a single project ─────────────────────
    async function gatherProjectContext(pid: any, label: string) {
      const project: any = await ctx.runQuery(api.projects.get, { projectId: pid });
      const sources: any[] = await ctx.runQuery(api.sources.listByProject, { projectId: pid });
      const requirements: any[] = await ctx.runQuery(api.requirements.listByProject, { projectId: pid });
      const stakeholders: any[] = await ctx.runQuery(api.stakeholders.listByProject, { projectId: pid });
      const decisions: any[] = await ctx.runQuery(api.decisions.listByProject, { projectId: pid });
      const conflicts: any[] = await ctx.runQuery(api.conflicts.listByProject, { projectId: pid });
      const brdDoc: any = await ctx.runQuery(api.documents.getLatest, { projectId: pid, type: "brd" });

      const parts: string[] = [
        `# ${label}: ${project?.name || "Unknown"}`,
        project?.description ? `Description: ${project.description}` : "",
        `Status: ${project?.status || "unknown"}`,
        "",
        `## Data Summary`,
        `- Sources: ${sources.length} uploaded`,
        `- Requirements: ${requirements.length} extracted`,
        `- Stakeholders: ${stakeholders.length} identified`,
        `- Decisions: ${decisions.length} found`,
        `- Conflicts: ${conflicts.length} detected`,
      ];

      // Include source content snippets
      if (sources.length > 0) {
        parts.push("", "## Source Documents");
        for (const src of sources.slice(0, 10)) {
          const snippet = src.content ? src.content.substring(0, 8000) : "(no content)";
          parts.push(
            `### ${src.name} (${src.type.replace(/_/g, " ")}, ${src.metadata?.wordCount || "?"} words)`,
            snippet, ""
          );
        }
        if (sources.length > 10) parts.push(`... and ${sources.length - 10} more sources not shown`);
      }

      // Include requirements
      if (requirements.length > 0) {
        parts.push("", "## Extracted Requirements");
        for (const r of requirements.slice(0, 15)) {
          parts.push(`- **${r.requirementId}**: ${r.title} (${r.priority}, ${r.category}) — ${r.description?.substring(0, 200) || ""}`);
        }
        if (requirements.length > 15) parts.push(`... and ${requirements.length - 15} more`);
      }

      // Include stakeholders
      if (stakeholders.length > 0) {
        parts.push("", "## Stakeholders");
        for (const s of stakeholders.slice(0, 10)) {
          parts.push(`- **${s.name}**: ${s.role} (${s.influence}) — ${s.concerns?.join(", ") || "no concerns listed"}`);
        }
      }

      // Include decisions
      if (decisions.length > 0) {
        parts.push("", "## Decisions");
        for (const d of decisions.slice(0, 10)) {
          parts.push(`- **${d.decisionId}**: ${d.title} (${d.type}, ${d.status}) — ${d.description?.substring(0, 200) || ""}`);
        }
      }

      // Include conflicts
      if (conflicts.length > 0) {
        parts.push("", "## Conflicts");
        for (const c of conflicts.slice(0, 5)) {
          parts.push(`- **${c.conflictId}**: ${c.title} (${c.severity}) — ${c.description?.substring(0, 200) || ""}`);
        }
      }

      // Include BRD
      if (brdDoc?.content) {
        try {
          const brd = JSON.parse(brdDoc.content);
          parts.push("", "## Current BRD (Generated)", `Version: ${brdDoc.version}`);
          if (brd.executiveSummary) parts.push(`Executive Summary: ${brd.executiveSummary.substring(0, 800)}`);
          if (brd.projectScope) parts.push(`Scope: ${JSON.stringify(brd.projectScope).substring(0, 500)}`);
        } catch {
          parts.push("", "## BRD: Generated (raw format)");
        }
      }

      return parts.filter(Boolean).join("\n");
    }

    // ─── Gather context for primary project ──────────────────────────────
    const primaryContext = await gatherProjectContext(projectId, "Primary Project");

    // ─── Gather context for additional projects (cross-project access) ───
    let crossProjectContext = "";
    if (additionalProjectIds && additionalProjectIds.length > 0) {
      const crossParts: string[] = ["\n\n---\n# Cross-Project Context (User-granted access)\n"];
      for (const extraPid of additionalProjectIds.slice(0, 5)) {
        const ctx_ = await gatherProjectContext(extraPid, "Linked Project");
        crossParts.push(ctx_, "\n---\n");
      }
      crossProjectContext = crossParts.join("\n");
    }

    // Chat history
    const chatHistory: any[] = await ctx.runQuery(api.chat.listMessages, { projectId });
    const recentHistory = chatHistory
      .slice(-10)
      .map((m: any) => `${m.role}: ${m.content.substring(0, 300)}`)
      .join("\n");

    const systemPrompt = `You are TraceLayer AI — the central intelligence assistant for business requirements analysis.

## Your Role
You are the PRIMARY interface users interact with. You orchestrate the entire workflow:
1. Users upload documents ←→ you analyze them
2. Users ask you to run agents ←→ the pipeline extracts intelligence
3. You help refine, modify, and generate BRD documents
4. You answer questions about the project intelligence

## Capabilities
- Analyze uploaded source documents (emails, transcripts, chat logs, documents)
- Review and critique extracted requirements
- Provide stakeholder analysis with influence mapping
- Identify conflicts and suggest resolutions
- Generate and refine BRD/PRD sections
- Suggest improvements and next steps
${additionalProjectIds && additionalProjectIds.length > 0 ? "- Compare and cross-reference data across linked projects" : ""}

## Guidelines
- Be direct and actionable. Don't just describe — recommend.
- Use markdown formatting with headers, bullets, bold text.
- When the user has uploaded sources but hasn't run the pipeline, suggest they do so.
- When referring to specific requirements, use their IDs (e.g., REQ-001).
- If you see gaps in the data, point them out proactively.
- Keep responses focused — avoid unnecessary preambles.
- NEVER output the full BRD document in chat. If the user asks to see the BRD, tell them it's available in the BRD Viewer.
- When discussing requirements, stakeholders, etc. give SPECIFIC insights and recommendations.
- If the pipeline has already run and the user asks to generate BRD or analyze docs, tell them the BRD has already been generated.
${additionalProjectIds && additionalProjectIds.length > 0 ? "- When referencing cross-project data, clearly state which project the data comes from." : ""}

## Project Context
${primaryContext}
${crossProjectContext}

## Recent Conversation
${recentHistory}`;

    // ─── Call AI ─────────────────────────────────────────────────────────
    const aiResponse = await callAIChat(apiKey, provider, systemPrompt, userMessage);

    // Store assistant response
    await ctx.runMutation(api.chat.sendMessage, {
      projectId,
      role: "assistant",
      content: aiResponse,
      metadata: { provider },
    });

    return { response: aiResponse };
  },
});

// ─── AI Provider Calls ───────────────────────────────────────────────────────
async function callAIChat(
  apiKey: string,
  provider: "openai" | "gemini" | "anthropic",
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
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error?.message || `OpenAI error: ${res.status}`
      );
    return data.choices[0].message.content;
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: systemPrompt + "\n\n---\n\nUser: " + userPrompt }] },
          ],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error?.message || `Gemini error: ${res.status}`
      );
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error?.message || `Anthropic error: ${res.status}`
      );
    return data.content[0].text;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
