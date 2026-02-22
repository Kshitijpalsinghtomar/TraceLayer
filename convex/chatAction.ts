"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

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
    provider: v.union(
      v.literal("openai"),
      v.literal("gemini"),
      v.literal("anthropic")
    ),
    apiKey: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const { projectId, userMessage, provider, apiKey } = args;

    // Store user message
    await ctx.runMutation(api.chat.sendMessage, {
      projectId,
      role: "user",
      content: userMessage,
      metadata: { provider },
    });

    // ─── Gather FULL project context ─────────────────────────────────────
    const project: any = await ctx.runQuery(api.projects.get, { projectId });
    const sources: any[] = await ctx.runQuery(api.sources.listByProject, {
      projectId,
    });
    const requirements: any[] = await ctx.runQuery(
      api.requirements.listByProject,
      { projectId }
    );
    const stakeholders: any[] = await ctx.runQuery(
      api.stakeholders.listByProject,
      { projectId }
    );
    const decisions: any[] = await ctx.runQuery(api.decisions.listByProject, {
      projectId,
    });
    const conflicts: any[] = await ctx.runQuery(api.conflicts.listByProject, {
      projectId,
    });
    const brdDoc: any = await ctx.runQuery(api.documents.getLatest, {
      projectId,
      type: "brd",
    });
    const chatHistory: any[] = await ctx.runQuery(api.chat.listMessages, {
      projectId,
    });

    // ─── Build rich context ──────────────────────────────────────────────
    const contextParts: string[] = [
      `# Project: ${project?.name || "Unknown"}`,
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

    // Include source content snippets (first 8000 chars each, up to 10 sources)
    if (sources.length > 0) {
      contextParts.push("", "## Source Documents");
      for (const src of sources.slice(0, 10)) {
        const snippet = src.content
          ? src.content.substring(0, 8000)
          : "(no content)";
        contextParts.push(
          `### ${src.name} (${src.type.replace(/_/g, " ")}, ${src.metadata?.wordCount || "?"} words)`,
          snippet,
          ""
        );
      }
      if (sources.length > 10) {
        contextParts.push(
          `... and ${sources.length - 10} more sources not shown`
        );
      }
    }

    // Include requirements
    if (requirements.length > 0) {
      contextParts.push("", "## Extracted Requirements");
      for (const r of requirements.slice(0, 15)) {
        contextParts.push(
          `- **${r.requirementId}**: ${r.title} (${r.priority}, ${r.category}) — ${r.description?.substring(0, 200) || ""}`
        );
      }
      if (requirements.length > 15)
        contextParts.push(`... and ${requirements.length - 15} more`);
    }

    // Include stakeholders
    if (stakeholders.length > 0) {
      contextParts.push("", "## Stakeholders");
      for (const s of stakeholders.slice(0, 10)) {
        contextParts.push(
          `- **${s.name}**: ${s.role} (${s.influence}) — ${s.concerns?.join(", ") || "no concerns listed"}`
        );
      }
    }

    // Include decisions
    if (decisions.length > 0) {
      contextParts.push("", "## Decisions");
      for (const d of decisions.slice(0, 10)) {
        contextParts.push(
          `- **${d.decisionId}**: ${d.title} (${d.type}, ${d.status}) — ${d.description?.substring(0, 200) || ""}`
        );
      }
    }

    // Include conflicts
    if (conflicts.length > 0) {
      contextParts.push("", "## Conflicts");
      for (const c of conflicts.slice(0, 5)) {
        contextParts.push(
          `- **${c.conflictId}**: ${c.title} (${c.severity}) — ${c.description?.substring(0, 200) || ""}`
        );
      }
    }

    // Include BRD
    if (brdDoc?.content) {
      try {
        const brd = JSON.parse(brdDoc.content);
        contextParts.push(
          "",
          "## Current BRD (Generated)",
          `Version: ${brdDoc.version}`
        );
        if (brd.executiveSummary)
          contextParts.push(
            `Executive Summary: ${brd.executiveSummary.substring(0, 800)}`
          );
        if (brd.projectScope)
          contextParts.push(
            `Scope: ${JSON.stringify(brd.projectScope).substring(0, 500)}`
          );
      } catch {
        contextParts.push("", "## BRD: Generated (raw format)");
      }
    }

    // Recent chat history
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

## Guidelines
- Be direct and actionable. Don't just describe — recommend.
- Use markdown formatting with headers, bullets, bold text.
- When the user has uploaded sources but hasn't run the pipeline, suggest they do so.
- When referring to specific requirements, use their IDs (e.g., REQ-001).
- If you see gaps in the data, point them out proactively.
- Keep responses focused — avoid unnecessary preambles.
- NEVER output the full BRD document in chat. If the user asks to see the BRD, tell them it's available in the BRD Viewer and that they can navigate there using the sidebar or the "View BRD Document" button.
- When discussing requirements, stakeholders, etc. give SPECIFIC insights and recommendations, not just raw data dumps.
- If the pipeline has already run and the user asks to generate BRD or analyze docs, tell them the BRD has already been generated and offer to help refine it.

## Project Context
${contextParts.filter(Boolean).join("\n")}

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
