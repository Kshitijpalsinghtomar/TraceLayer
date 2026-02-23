"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { SOUL_DOCUMENT, EXTRACTION_SPEC, BRD_TEMPLATE } from "./agentKnowledge";

// ─── Helper: Call AI Provider ────────────────────────────────────────────────
async function callAI(
  apiKey: string,
  provider: "openai" | "gemini" | "anthropic",
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true,
  maxTokens: number = 8192
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
        temperature: 0.3,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);
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
            {
              parts: [
                { text: systemPrompt + "\n\n" + userPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            ...(jsonMode
              ? { responseMimeType: "application/json" }
              : {}),
          },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`);
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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic error: ${JSON.stringify(data)}`);
    return data.content[0].text;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Helper: Safe JSON parse ─────────────────────────────────────────────────
function safeJsonParse(text: string): unknown {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // fall through
      }
    }
    // Try to find JSON object/array in text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // fall through
      }
    }
    throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 200)}`);
  }
}

// ─── MAIN EXTRACTION PIPELINE ────────────────────────────────────────────────
export const runExtractionPipeline = action({
  args: {
    projectId: v.id("projects"),
    provider: v.optional(v.union(v.literal("openai"), v.literal("gemini"), v.literal("anthropic"))),
    apiKey: v.optional(v.string()), // deprecated — ignored, resolved server-side
    regenerate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    const { projectId, regenerate } = args;

    // Resolve API key server-side (never trust client-provided keys)
    const resolved = await ctx.runQuery(internal.apiKeys.resolveProviderAndKey, {
      preferredProvider: args.provider,
    });
    if (!resolved) {
      throw new Error("No API key configured. An admin must configure an AI provider key in Settings.");
    }
    const { provider, apiKey } = resolved;

    // ─── CHECK 1: Is pipeline already running? ─────────────────────────────
    const runs = await ctx.runQuery(api.pipeline.getLatestRun, { projectId });
    if (runs && !["completed", "failed", "cancelled"].includes(runs.status)) {
      throw new Error(`Pipeline is already running (status: ${runs.status}). Please wait for it to complete or cancel it first.`);
    }

    // ─── CHECK 2: Clear existing data if regenerating ──────────────────────
    if (regenerate) {
      await ctx.runMutation(api.projects.clearExtractionData, { projectId });
    }

    // Create extraction run
    const runId = await ctx.runMutation(api.pipeline.createRun, { projectId });

    const logMsg = async (
      agent: string,
      level: string,
      message: string,
      detail?: string
    ) => {
      await ctx.runMutation(api.pipeline.log, {
        projectId,
        extractionRunId: runId,
        agent: agent as any,
        level: level as any,
        message,
        detail,
      });
    };

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 1: INGESTION
      // ═══════════════════════════════════════════════════════════════════════
      await logMsg("orchestrator", "info", "🚀 Pipeline started — TraceLayer Intelligence Engine v1.0");
      await logMsg("orchestrator", "info", `Provider: ${provider.toUpperCase()} | Project: ${projectId}`);

      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "ingesting",
      });
      await ctx.runMutation(api.projects.update, {
        projectId,
        status: "processing",
        progress: 5,
      });

      // Get all sources
      const sources: any[] = await ctx.runQuery(api.sources.listByProject, { projectId });
      await logMsg(
        "ingestion_agent",
        "processing",
        `📥 Found ${sources.length} source(s) to process`,
        JSON.stringify(sources.map((s) => ({ name: s.name, type: s.type, words: s.metadata?.wordCount })))
      );

      if (sources.length === 0) {
        await logMsg("orchestrator", "error", "❌ No sources found. Upload communication data first.");
        await ctx.runMutation(api.pipeline.updateRunStatus, {
          runId,
          status: "failed",
          error: "No sources found",
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 2: CLASSIFICATION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "classifying",
      });
      await ctx.runMutation(api.projects.update, { projectId, progress: 15 });

      await logMsg("classification_agent", "processing", "🔍 Classifying source relevance...");

      for (const source of sources) {
        await ctx.runMutation(api.sources.updateStatus, {
          sourceId: source._id,
          status: "classifying",
        });

        const classifyPrompt = `Analyze this communication and classify its relevance to a business project.
Rate relevance from 0.0 to 1.0 where 1.0 is highly relevant to business requirements.

Return JSON:
{
  "relevance": <number>,
  "type_detected": "email" | "meeting_transcript" | "chat_log" | "document",
  "summary": "<one sentence summary>",
  "has_requirements": <boolean>,
  "has_decisions": <boolean>,
  "has_stakeholders": <boolean>,
  "key_topics": ["<topic1>", "<topic2>"]
}

Communication source "${source.name}":
${source.content.substring(0, 32000)}`;

        const classResult = await callAI(
          apiKey,
          provider,
          "You are a communication classifier for a requirements intelligence system. " + SOUL_DOCUMENT.substring(0, 800),
          classifyPrompt
        );

        const classification = safeJsonParse(classResult) as any;

        await ctx.runMutation(api.sources.updateStatus, {
          sourceId: source._id,
          status: "classified",
          relevanceScore: classification.relevance || 0.5,
        });

        await logMsg(
          "classification_agent",
          "success",
          `✅ Classified "${source.name}" — relevance: ${(classification.relevance * 100).toFixed(0)}% | Topics: ${(classification.key_topics || []).join(", ")}`,
          JSON.stringify(classification)
        );
      }

      await ctx.runMutation(api.projects.update, { projectId, progress: 25 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 3: REQUIREMENT EXTRACTION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_requirements",
      });
      await logMsg("requirement_agent", "processing", "⚙️ Extracting requirements from classified sources...");

      // Query existing requirements to start counter after highest existing ID
      // This prevents duplicate REQ-xxx IDs when running pipeline multiple times
      const existingReqs = await ctx.runQuery(api.requirements.listByProject, { projectId });
      let reqCounter = existingReqs.reduce((max: number, r: any) => {
        const num = parseInt(r.requirementId?.replace("REQ-", "") || "0", 10);
        return num > max ? num : max;
      }, 0);
      const allRequirementIds: string[] = [];

      // Build a set of normalized titles from existing requirements for cross-source dedup
      const existingTitleWords = new Map<string, string>(); // normalized key → existing requirementId
      for (const r of existingReqs) {
        const key = (r.title || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
        if (key) existingTitleWords.set(key, r.requirementId);
      }

      // Helper: check if two titles are similar (>70% word overlap)
      const isSimilarTitle = (a: string, b: string): boolean => {
        const wordsA = new Set(a.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
        const wordsB = new Set(b.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
        if (wordsA.size === 0 || wordsB.size === 0) return false;
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const minSize = Math.min(wordsA.size, wordsB.size);
        return intersection / minSize >= 0.7;
      };

      for (const source of sources) {
        await ctx.runMutation(api.sources.updateStatus, {
          sourceId: source._id,
          status: "extracting",
        });

        // ─── Chunk large sources to avoid truncation ──────────────────────
        const CHUNK_SIZE = 35000;
        const OVERLAP = 2000;
        const content = source.content;
        const chunks: string[] = [];

        if (content.length <= CHUNK_SIZE) {
          chunks.push(content);
        } else {
          // Split into overlapping chunks so no requirement is lost at a boundary
          let start = 0;
          while (start < content.length) {
            const end = Math.min(start + CHUNK_SIZE, content.length);
            chunks.push(content.substring(start, end));
            start = end - OVERLAP;
            if (start >= content.length - OVERLAP) break; // avoid tiny trailing chunks
          }
          await logMsg(
            "requirement_agent",
            "info",
            `📦 Source "${source.name}" is ${(content.length / 1000).toFixed(0)}K chars — splitting into ${chunks.length} chunks for thorough extraction`,
          );
        }

        const allChunkReqs: any[] = [];

        for (let ci = 0; ci < chunks.length; ci++) {
          const chunkLabel = chunks.length > 1 ? ` (chunk ${ci + 1}/${chunks.length})` : "";

          const reqPrompt = `${EXTRACTION_SPEC}

Extract ALL requirements from this communication${chunkLabel}. Be EXTREMELY thorough — capture every system capability, constraint, behavior, quality attribute, business rule, integration need, performance expectation, security requirement, and compliance need mentioned.

Dig deep. Look for:
- Explicit requirements ("must", "shall", "need")
- Implicit requirements (features mentioned casually, assumptions about system behavior)
- Non-functional requirements (performance, security, scalability mentions)
- Business rules and constraints
- Integration and dependency requirements
- User experience expectations
- Data requirements and formats

For each requirement, write a DETAILED description (2-3 sentences minimum) that explains what the requirement means, why it matters, and how it should work.

Return JSON:
{
  "requirements": [
    {
      "title": "<concise but descriptive requirement title>",
      "description": "<detailed 2-3 sentence description explaining the requirement, its context, rationale, and expected behavior>",
      "category": "functional" | "non_functional" | "business" | "technical" | "security" | "performance" | "compliance" | "integration",
      "priority": "critical" | "high" | "medium" | "low",
      "confidence": <0.0-1.0>,
      "source_excerpt": "<exact quote from the source that supports this requirement>",
      "reasoning": "<why this was extracted as a requirement and how you determined its priority>",
      "tags": ["<tag1>", "<tag2>"]
    }
  ]
}

Source "${source.name}" (type: ${source.type})${chunkLabel}:
${chunks[ci]}`;

          const reqResult = await callAI(
            apiKey,
            provider,
            "You are a precision requirements extraction agent. " + SOUL_DOCUMENT.substring(0, 500),
            reqPrompt,
            true,
            16384
          );

          const extracted = safeJsonParse(reqResult) as any;
          const chunkReqs = extracted.requirements || [];
          allChunkReqs.push(...chunkReqs);

          if (chunks.length > 1) {
            await logMsg(
              "requirement_agent",
              "processing",
              `  📋 Chunk ${ci + 1}: Found ${chunkReqs.length} requirement(s)`,
            );
          }
        }

        // Deduplicate requirements from overlapping chunks (by title similarity)
        const seenTitles = new Set<string>();
        const uniqueReqs: any[] = [];
        for (const req of allChunkReqs) {
          const normalizedTitle = (req.title || "").toLowerCase().trim();
          if (!seenTitles.has(normalizedTitle)) {
            seenTitles.add(normalizedTitle);
            uniqueReqs.push(req);
          }
        }

        await logMsg(
          "requirement_agent",
          "processing",
          `📋 Found ${uniqueReqs.length} unique requirement(s) in "${source.name}"${chunks.length > 1 ? ` (${allChunkReqs.length} before dedup)` : ""}`,
        );

        for (const req of uniqueReqs) {
          const title = req.title || "Untitled Requirement";

          // Cross-source deduplication: skip if similar title already exists
          const isDuplicate = [...existingTitleWords.keys()].some(
            (existingTitle) => isSimilarTitle(title, existingTitle)
          );
          if (isDuplicate) {
            await logMsg(
              "requirement_agent",
              "info",
              `  ⏭️ Skipped duplicate: "${title}" (similar requirement already exists)`,
            );
            continue;
          }

          reqCounter++;
          const reqId = `REQ-${String(reqCounter).padStart(3, "0")}`;

          // Track this new title for dedup against subsequent requirements
          const normalizedKey = title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
          if (normalizedKey) existingTitleWords.set(normalizedKey, reqId);

          const storedId = await ctx.runMutation(api.requirements.store, {
            projectId,
            requirementId: reqId,
            title: req.title || "Untitled Requirement",
            description: req.description || "",
            category: req.category || "functional",
            priority: req.priority || "medium",
            confidenceScore: req.confidence || 0.7,
            sourceId: source._id,
            sourceExcerpt: req.source_excerpt || "",
            extractionReasoning: req.reasoning || "",
            tags: req.tags || [],
          });

          allRequirementIds.push(storedId);

          // Create traceability link: source → requirement
          await ctx.runMutation(api.traceability.store, {
            projectId,
            fromType: "source",
            fromId: source._id,
            toType: "requirement",
            toId: storedId,
            relationship: "extracted_from",
            strength: req.confidence || 0.7,
          });

          await logMsg(
            "requirement_agent",
            "success",
            `  → ${reqId}: "${req.title}" [${req.category}] confidence: ${((req.confidence || 0.7) * 100).toFixed(0)}%`,
          );
        }

        await ctx.runMutation(api.sources.updateStatus, {
          sourceId: source._id,
          status: "extracted",
        });
      }

      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_requirements",
        requirementsFound: reqCounter,
        sourcesProcessed: sources.length,
      });
      await ctx.runMutation(api.projects.update, { projectId, progress: 45 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 4: STAKEHOLDER EXTRACTION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_stakeholders",
      });
      await logMsg("stakeholder_agent", "processing", "👥 Identifying stakeholders across all sources...");

      const allSourceContent = sources
        .map((s) => `[Source: ${s.name} (${s.type})]\n${s.content}`)
        .join("\n\n---\n\n")
        .substring(0, 60000);

      const stakeholderPrompt = `Identify ALL stakeholders mentioned across these communications.
A stakeholder is anyone who proposes, approves, influences, or is affected by requirements.

Be thorough — look for:
- Named individuals (who said what)
- Referenced teams, departments, or roles
- External parties (clients, vendors, regulators)
- Implied decision-makers ("management approved", "the board decided")

For each stakeholder, provide detailed context about their involvement.

Return JSON:
{
  "stakeholders": [
    {
      "name": "<full name or role if name unknown>",
      "role": "<job title or role description>",
      "department": "<department if known>",
      "influence": "decision_maker" | "influencer" | "contributor" | "observer",
      "sentiment": "supportive" | "neutral" | "resistant" | "unknown",
      "mention_context": "<detailed context of their involvement, what they said, and their stance>",
      "concerns": ["<specific concern or priority this stakeholder has>"]
    }
  ]
}

Communications:
${allSourceContent}`;

      const stakeholderResult = await callAI(
        apiKey,
        provider,
        "You are a stakeholder intelligence agent. " + SOUL_DOCUMENT.substring(0, 500),
        stakeholderPrompt,
        true,
        12288
      );

      const stakeholderData = safeJsonParse(stakeholderResult) as any;
      const extractedStakeholders = stakeholderData.stakeholders || [];

      for (const sh of extractedStakeholders) {
        const shId = await ctx.runMutation(api.stakeholders.store, {
          projectId,
          name: sh.name || "Unknown",
          role: sh.role || "Unknown",
          department: sh.department,
          influence: sh.influence || "contributor",
          sentiment: sh.sentiment || "unknown",
          sourceIds: sources.filter((s) => s.content.toLowerCase().includes((sh.name || "").toLowerCase())).map((s) => s._id).length > 0
            ? sources.filter((s) => s.content.toLowerCase().includes((sh.name || "").toLowerCase())).map((s) => s._id)
            : sources.map((s) => s._id),
        });

        await logMsg(
          "stakeholder_agent",
          "success",
          `  → Identified: ${sh.name} (${sh.role}) — ${sh.influence} — sentiment: ${sh.sentiment || "unknown"}`,
        );

        // Create traceability links — link to each source that actually mentions this stakeholder
        const mentioningSources = sources.filter((s) => s.content.toLowerCase().includes((sh.name || "").toLowerCase()));
        const linkSources = mentioningSources.length > 0 ? mentioningSources : [sources[0]];
        for (const linkSource of linkSources) {
          await ctx.runMutation(api.traceability.store, {
            projectId,
            fromType: "stakeholder",
            fromId: shId,
            toType: "source",
            toId: linkSource._id,
            relationship: "mentioned_in",
            strength: mentioningSources.length > 0 ? 0.9 : 0.5,
          });
        }
      }

      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_stakeholders",
        stakeholdersFound: extractedStakeholders.length,
      });
      await ctx.runMutation(api.projects.update, { projectId, progress: 55 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 5: DECISION EXTRACTION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_decisions",
      });
      await logMsg("decision_agent", "processing", "🔑 Extracting decisions and approvals...");

      const decisionPrompt = `Extract ALL confirmed decisions from these communications.
A decision is a confirmed architectural, functional, business, or technical choice.

Be thorough — look for:
- Explicit decisions ("we decided", "agreed to", "approved")
- Implicit decisions (technology choices mentioned as settled, architectural patterns assumed)
- Process decisions (methodology, workflow, approval chains)
- Scope decisions (what's in/out, phase priorities)

For each decision, provide detailed context about what was decided and why.

Return JSON:
{
  "decisions": [
    {
      "title": "<clear decision title>",
      "description": "<detailed 2-3 sentence description of what was decided, the context, and the rationale>",
      "type": "architectural" | "functional" | "business" | "technical" | "process",
      "status": "proposed" | "approved" | "rejected" | "deferred",
      "made_by": "<who made or approved this decision>",
      "source_excerpt": "<exact quote that evidences this decision>",
      "confidence": <0.0-1.0>,
      "impacted_requirements": ["<brief description of affected requirement>"]
    }
  ]
}

IMPORTANT: The "type" field MUST be exactly one of: "architectural", "functional", "business", "technical", or "process". Do NOT use "scope" or any other value. If it is a scope decision, classify it as "business" or "functional".

Communications:
${allSourceContent}`;

      const decisionResult = await callAI(
        apiKey,
        provider,
        "You are a decision intelligence agent. " + SOUL_DOCUMENT.substring(0, 500),
        decisionPrompt,
        true,
        12288
      );

      const decisionData = safeJsonParse(decisionResult) as any;
      const extractedDecisions = decisionData.decisions || [];
      let decCounter = 0;

      for (const dec of extractedDecisions) {
        decCounter++;
        const decId = `DEC-${String(decCounter).padStart(3, "0")}`;

        // Ensure type is valid
        const validTypes = ["architectural", "functional", "business", "technical", "process"];
        let decType = dec.type || "technical";
        if (!validTypes.includes(decType)) {
          if (decType === "scope") decType = "business";
          else decType = "technical";
        }

        const storedDecId = await ctx.runMutation(api.decisions.store, {
          projectId,
          decisionId: decId,
          title: dec.title || "Untitled Decision",
          description: dec.description || "",
          type: decType,
          status: dec.status || "proposed",
          sourceId: (() => {
            // Try to match decision source_excerpt to actual source content
            const excerpt = (dec.source_excerpt || "").toLowerCase();
            if (excerpt.length > 10) {
              const match = sources.find((s) => s.content.toLowerCase().includes(excerpt.substring(0, 100)));
              if (match) return match._id;
            }
            return sources[0]._id;
          })(),
          sourceExcerpt: dec.source_excerpt || "",
          confidenceScore: dec.confidence || 0.7,
        });

        await logMsg(
          "decision_agent",
          "success",
          `  → ${decId}: "${dec.title}" [${dec.type}] — ${dec.status}`,
        );

        // Create traceability link — match to correct source
        const decSourceId = (() => {
          const excerpt = (dec.source_excerpt || "").toLowerCase();
          if (excerpt.length > 10) {
            const match = sources.find((s) => s.content.toLowerCase().includes(excerpt.substring(0, 100)));
            if (match) return match._id;
          }
          return sources[0]._id;
        })();
        await ctx.runMutation(api.traceability.store, {
          projectId,
          fromType: "decision",
          fromId: storedDecId,
          toType: "source",
          toId: decSourceId,
          relationship: "decided_in",
          strength: dec.confidence || 0.7,
        });
      }

      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_decisions",
        decisionsFound: decCounter,
      });
      await ctx.runMutation(api.projects.update, { projectId, progress: 65 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 6: TIMELINE EXTRACTION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "extracting_timeline",
      });
      await logMsg("timeline_agent", "processing", "📅 Extracting timeline events and milestones...");

      const timelinePrompt = `Extract ALL timeline events, milestones, deadlines, and date-related items.

Return JSON:
{
  "events": [
    {
      "title": "<event title>",
      "description": "<what happens>",
      "date": "<date if mentioned, or null>",
      "type": "milestone" | "deadline" | "decision" | "approval" | "dependency",
      "confidence": <0.0-1.0>
    }
  ]
}

Communications:
${allSourceContent}`;

      const timelineResult = await callAI(
        apiKey,
        provider,
        "You are a timeline intelligence agent. Extract dates, milestones, and deadlines.",
        timelinePrompt
      );

      const timelineData = safeJsonParse(timelineResult) as any;
      const events = timelineData.events || [];
      let timelineCount = 0;

      for (const evt of events) {
        const validTypes = ["milestone", "deadline", "decision", "approval", "dependency"];
        const evtType = validTypes.includes(evt.type) ? evt.type : "milestone";

        await ctx.runMutation(api.timeline.store, {
          projectId,
          title: evt.title || "Untitled Event",
          description: evt.description || "",
          date: evt.date || undefined,
          type: evtType,
          sourceId: sources.length > 0 ? sources[0]._id : undefined,
          confidenceScore: evt.confidence || 0.7,
        });
        timelineCount++;

        await logMsg(
          "timeline_agent",
          "success",
          `  → ${evt.type}: "${evt.title}" ${evt.date ? `(${evt.date})` : "(no date)"}`,
        );
      }

      await logMsg("timeline_agent", "success", `✅ Stored ${timelineCount} timeline events`);
      await ctx.runMutation(api.projects.update, { projectId, progress: 75 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 7: CONFLICT DETECTION
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "detecting_conflicts",
      });
      await logMsg("conflict_agent", "processing", "⚡ Scanning for requirement conflicts...");

      // Get all extracted requirements for conflict analysis
      const allReqs: any[] = await ctx.runQuery(api.requirements.listByProject, { projectId });

      if (allReqs.length >= 2) {
        const conflictPrompt = `Analyze these requirements for conflicts, contradictions, or incompatibilities.

Requirements:
${allReqs.map((r) => `${r.requirementId}: ${r.title} — ${r.description}`).join("\n")}

Return JSON:
{
  "conflicts": [
    {
      "title": "<conflict title>",
      "description": "<what conflicts>",
      "severity": "critical" | "major" | "minor",
      "requirement_ids": ["<REQ-xxx>", "<REQ-yyy>"],
      "explanation": "<why these conflict>"
    }
  ]
}

If no conflicts found, return { "conflicts": [] }`;

        const conflictResult = await callAI(
          apiKey,
          provider,
          "You are a conflict detection agent. Identify contradictions between requirements.",
          conflictPrompt
        );

        const conflictData = safeJsonParse(conflictResult) as any;
        const conflicts = conflictData.conflicts || [];

        for (const conflict of conflicts) {
          // Find matching requirement IDs
          const matchingReqIds = allReqs
            .filter((r) => (conflict.requirement_ids || []).includes(r.requirementId))
            .map((r) => r._id);

          if (matchingReqIds.length >= 2) {
            await ctx.runMutation(api.conflicts.store, {
              projectId,
              conflictId: `CON-${String(conflicts.indexOf(conflict) + 1).padStart(3, "0")}`,
              title: conflict.title,
              description: conflict.description + " | " + (conflict.explanation || ""),
              severity: conflict.severity || "minor",
              requirementIds: matchingReqIds,
            });

            await logMsg(
              "conflict_agent",
              "warning",
              `  ⚠️ ${conflict.severity?.toUpperCase()}: "${conflict.title}" — ${(conflict.requirement_ids || []).join(" vs ")}`,
            );
          }
        }

        if (conflicts.length === 0) {
          await logMsg("conflict_agent", "success", "✅ No conflicts detected between requirements.");
        }
      } else {
        await logMsg("conflict_agent", "info", "ℹ️ Not enough requirements for conflict analysis.");
      }

      await ctx.runMutation(api.projects.update, { projectId, progress: 85 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 8: BUILD TRACEABILITY
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "building_traceability",
      });
      await logMsg("traceability_agent", "processing", "🔗 Building traceability graph...");

      // Build stakeholder → requirement links
      const stakeholders: any[] = await ctx.runQuery(api.stakeholders.listByProject, { projectId });
      const updatedReqs: any[] = await ctx.runQuery(api.requirements.listByProject, { projectId });

      let linkCount = 0;

      for (const req of updatedReqs) {
        for (const sh of stakeholders) {
          // Link if source excerpt mentions stakeholder name
          if (req.sourceExcerpt.toLowerCase().includes(sh.name.toLowerCase())) {
            await ctx.runMutation(api.traceability.store, {
              projectId,
              fromType: "requirement",
              fromId: req._id,
              toType: "stakeholder",
              toId: sh._id,
              relationship: "proposed_by",
              strength: 0.85,
            });
            linkCount++;
          }
        }
      }

      // Build decision → requirement links (match by impacted_requirements text or title overlap)
      const traceDecisions: any[] = await ctx.runQuery(api.decisions.listByProject, { projectId });
      for (const dec of traceDecisions) {
        const decDesc = ((dec.description || "") + " " + (dec.title || "")).toLowerCase();
        for (const req of updatedReqs) {
          const reqTitle = (req.title || "").toLowerCase();
          const reqId = (req.requirementId || "").toLowerCase();
          // Link if the decision description mentions the requirement title or ID
          if (
            (reqTitle.length > 5 && decDesc.includes(reqTitle.substring(0, 30))) ||
            decDesc.includes(reqId)
          ) {
            await ctx.runMutation(api.traceability.store, {
              projectId,
              fromType: "decision",
              fromId: dec._id,
              toType: "requirement",
              toId: req._id,
              relationship: "affects",
              strength: 0.75,
            });
            linkCount++;
          }
        }
        // If no requirement link found, link decision to at least one requirement (the first one)
        if (updatedReqs.length > 0) {
          const linked = updatedReqs.some((req) => {
            const reqTitle = (req.title || "").toLowerCase();
            const reqId = (req.requirementId || "").toLowerCase();
            return (
              (reqTitle.length > 5 && decDesc.includes(reqTitle.substring(0, 30))) ||
              decDesc.includes(reqId)
            );
          });
          if (!linked) {
            // Link to the most relevant requirement by keyword overlap
            let bestReq = updatedReqs[0];
            let bestScore = 0;
            for (const req of updatedReqs) {
              const words = (req.title || "").toLowerCase().split(/\s+/);
              const score = words.filter((w: string) => w.length > 3 && decDesc.includes(w)).length;
              if (score > bestScore) {
                bestScore = score;
                bestReq = req;
              }
            }
            await ctx.runMutation(api.traceability.store, {
              projectId,
              fromType: "decision",
              fromId: dec._id,
              toType: "requirement",
              toId: bestReq._id,
              relationship: "affects",
              strength: 0.5,
            });
            linkCount++;
          }
        }
      }

      // Build conflict → requirement links
      const conflictsData: any[] = await ctx.runQuery(api.conflicts.listByProject, { projectId });
      for (const conflict of conflictsData) {
        // Conflicts already store requirementIds — create traceability links for them
        const conflictReqIds = conflict.requirementIds || [];
        for (const reqDbId of conflictReqIds) {
          await ctx.runMutation(api.traceability.store, {
            projectId,
            fromType: "conflict",
            fromId: conflict._id,
            toType: "requirement",
            toId: reqDbId,
            relationship: "blocks",
            strength: conflict.severity === "critical" ? 0.95 : conflict.severity === "major" ? 0.8 : 0.6,
          });
          linkCount++;
        }
      }

      // Build timeline → source links (connect timeline events to the first source)
      const timelineEvents: any[] = await ctx.runQuery(api.timeline.listByProject, { projectId });
      for (const evt of timelineEvents) {
        const evtSourceId = (evt as any).sourceId || (sources.length > 0 ? sources[0]._id : null);
        if (evtSourceId) {
          await ctx.runMutation(api.traceability.store, {
            projectId,
            fromType: "timeline",
            fromId: evt._id,
            toType: "source",
            toId: evtSourceId,
            relationship: "mentioned_in",
            strength: 0.7,
          });
          linkCount++;
        }
      }

      await logMsg("traceability_agent", "success", `✅ Traceability graph built — ${linkCount} links across ${updatedReqs.length} requirements, ${stakeholders.length} stakeholders, ${traceDecisions.length} decisions, ${conflictsData.length} conflicts, ${timelineEvents.length} timeline events`);
      await ctx.runMutation(api.projects.update, { projectId, progress: 90 });

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 9: GENERATE DOCUMENTS
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "generating_documents",
      });
      await logMsg("document_agent", "processing", "📄 Generating BRD from structured intelligence...");

      const brdDecisions: any[] = await ctx.runQuery(api.decisions.listByProject, { projectId });
      const brdConflicts: any[] = await ctx.runQuery(api.conflicts.listByProject, { projectId });
      const project: any = await ctx.runQuery(api.projects.get, { projectId });

      // Build a comprehensive data summary for the BRD generation AI
      const sourcesSummary = sources.map(s => `- "${s.name}" (${s.type.replace(/_/g, " ")}, ${s.metadata?.wordCount || "?"} words)`).join("\n");
      const channelList = [...new Set(sources.map(s => s.type.replace(/_/g, " ")))].join(", ");

      const reqsSummary = updatedReqs.map(r =>
        `${r.requirementId} [${r.category}/${r.priority}] (confidence: ${(r.confidenceScore * 100).toFixed(0)}%): ${r.title}\n  Description: ${r.description}\n  Source evidence: "${r.sourceExcerpt?.substring(0, 1000) || "N/A"}"\n  Reasoning: ${r.extractionReasoning || "N/A"}`
      ).join("\n\n");

      const stakeholdersSummary = stakeholders.map(s =>
        `- ${s.name} (${s.role}${s.department ? `, ${s.department}` : ""}) — Influence: ${s.influence} — Sentiment: ${s.sentiment || "unknown"}`
      ).join("\n");

      const decisionsSummary = brdDecisions.map((d: any) =>
        `${d.decisionId} [${d.type}/${d.status}]: ${d.title}\n  ${d.description}\n  Evidence: "${d.sourceExcerpt?.substring(0, 1000) || "N/A"}"`
      ).join("\n\n");

      const conflictsSummary = brdConflicts.map((c: any) =>
        `${c.conflictId} [${c.severity}]: ${c.title}\n  ${c.description}\n  Resolution: ${c.suggestedResolution || "None proposed"}`
      ).join("\n\n");

      // Category breakdown
      const catBreakdown = Object.entries(
        updatedReqs.reduce((acc: Record<string, number>, r: any) => {
          acc[r.category] = (acc[r.category] || 0) + 1;
          return acc;
        }, {})
      ).map(([cat, count]) => `${cat}: ${count}`).join(", ");

      // Priority breakdown
      const priBreakdown = Object.entries(
        updatedReqs.reduce((acc: Record<string, number>, r: any) => {
          acc[r.priority] = (acc[r.priority] || 0) + 1;
          return acc;
        }, {})
      ).map(([pri, count]) => `${pri}: ${count}`).join(", ");

      const avgConfidence = updatedReqs.length > 0
        ? (updatedReqs.reduce((sum: number, r: any) => sum + r.confidenceScore, 0) / updatedReqs.length)
        : 0;

      // Include source content snippets for context
      const sourceContentSnippets = sources.map(s =>
        `--- ${s.name} (${s.type}) ---\n${s.content.substring(0, 15000)}`
      ).join("\n\n").substring(0, 50000);

      const brdPrompt = `${BRD_TEMPLATE}

You are generating a COMPREHENSIVE Intelligence-Driven BRD for project "${project?.name || "TraceLayer Project"}".
${project?.description ? `Project description: ${project.description}` : ""}

========== EXTRACTED INTELLIGENCE DATA ==========

SOURCES ANALYZED (${sources.length} total):
${sourcesSummary}
Communication channels: ${channelList}

REQUIREMENTS EXTRACTED (${updatedReqs.length} total):
Category breakdown: ${catBreakdown}
Priority breakdown: ${priBreakdown}
Average confidence: ${(avgConfidence * 100).toFixed(0)}%

Full requirements:
${reqsSummary}

STAKEHOLDERS IDENTIFIED (${stakeholders.length} total):
${stakeholdersSummary}

DECISIONS EXTRACTED (${brdDecisions.length} total):
${decisionsSummary || "No decisions identified."}

CONFLICTS DETECTED (${brdConflicts.length} total):
${conflictsSummary || "No conflicts detected."}

SOURCE CONTENT (for deeper context):
${sourceContentSnippets}

========== END DATA ==========

Now generate the BRD as JSON. CRITICAL RULES:
1. The executiveSummary MUST be 4-6 detailed paragraphs (800-1500 words). Not a short blurb. Start with a domain context paragraph.
2. The projectOverview MUST be 2-3 paragraphs explaining the project, referencing specific topics from the source content.
3. Business objectives must have 3-5 sentence descriptions with business context and rationale.
4. The scopeDefinition items must each be a full sentence with explanation, NOT just labels.
5. stakeholderAnalysis, functionalAnalysis, nonFunctionalAnalysis, decisionAnalysis, riskAssessment MUST each be 300-600 words of substantive professional analysis.
6. DO NOT just repeat the raw data. SYNTHESIZE, ANALYZE, and WRITE insights. Find patterns, draw connections, and produce analysis that goes BEYOND what's obvious from the data.
7. ALWAYS cite specific requirement IDs (REQ-001 etc.), stakeholder names, and decision IDs (DEC-001 etc.) inline in your narrative. Every paragraph must reference specific data.
8. Be specific and actionable — NEVER use generic phrases like "various stakeholders" or "comprehensive solution". Name actual entities.
9. If you notice duplicate or similar requirements, consolidate them in your analysis and note the convergence as evidence of importance.
10. Write in active voice. Structure every paragraph with a topic sentence making an analytical claim, followed by supporting evidence.

Return ONLY valid JSON:
{
  "executiveSummary": "<4-6 paragraphs, 800-1500 words, comprehensive executive summary>",
  "projectOverview": "<2-3 paragraphs project overview>",
  "businessObjectives": [
    {
      "id": "OBJ-001",
      "title": "<objective title>",
      "description": "<detailed 3-5 sentence description with context and rationale>",
      "successCriteria": "<specific measurable success criteria>",
      "linkedRequirements": ["REQ-xxx", "REQ-yyy"],
      "metrics": "<KPIs to track>",
      "owner": "<stakeholder name responsible>"
    }
  ],
  "scopeDefinition": {
    "inScope": ["<item with explanation>"],
    "outOfScope": ["<item with reasoning>"],
    "assumptions": ["<key assumption>"],
    "constraints": ["<constraint identified>"]
  },
  "stakeholderAnalysis": "<multi-paragraph stakeholder analysis narrative>",
  "functionalAnalysis": "<multi-paragraph analysis of functional requirements landscape>",
  "nonFunctionalAnalysis": "<multi-paragraph analysis of non-functional requirements>",
  "decisionAnalysis": "<multi-paragraph analysis of decisions and governance>",
  "riskAssessment": "<multi-paragraph risk and conflict analysis with recommendations>",
  "intelligenceSummary": {
    "totalSources": ${sources.length},
    "communicationChannels": [${[...new Set(sources.map(s => `"${s.type}"`))].join(",")}],
    "totalRequirements": ${updatedReqs.length},
    "totalStakeholders": ${stakeholders.length},
    "totalDecisions": ${brdDecisions.length},
    "totalConflicts": ${brdConflicts.length},
    "overallConfidence": ${avgConfidence.toFixed(2)},
    "categoryBreakdown": "${catBreakdown}",
    "priorityBreakdown": "${priBreakdown}",
    "summary": "<comprehensive intelligence summary paragraph>"
  },
  "confidenceReport": {
    "highConfidence": ${updatedReqs.filter(r => r.confidenceScore >= 0.8).length},
    "mediumConfidence": ${updatedReqs.filter(r => r.confidenceScore >= 0.5 && r.confidenceScore < 0.8).length},
    "lowConfidence": ${updatedReqs.filter(r => r.confidenceScore < 0.5).length},
    "overallScore": ${avgConfidence.toFixed(2)},
    "coverageGaps": ["<identified gap>"],
    "recommendations": ["<specific actionable recommendation>"]
  }
}`;

      const brdResult = await callAI(
        apiKey,
        provider,
        `You are a senior business analyst generating an intelligence-driven Business Requirements Document. Your output quality MUST meet these standards:

1. WRITE LIKE A PROFESSIONAL ANALYST presenting to C-level executives. Every sentence must carry substance.
2. CITE SPECIFIC DATA in every paragraph: requirement IDs (REQ-xxx), stakeholder names, decision IDs (DEC-xxx), and confidence percentages. A paragraph without specific references is a FAILURE.
3. SYNTHESIZE — don't just list data. Find patterns, identify themes, draw connections between requirements, and surface insights that aren't obvious from reading the raw data.
4. NEVER use filler phrases like "various stakeholders", "multiple requirements", "comprehensive solution", or "robust system". Always name the actual entities.
5. Each analysis section MUST be 300-600 words of substantive narrative, not bullet lists.
6. The executive summary MUST be 800-1500 words (4-6 paragraphs) starting with domain context.
7. Generate ONLY from the provided extracted intelligence. Never hallucinate data.
8. If duplicate requirements exist, consolidate them and note the convergence as evidence of importance.
9. Write in active voice with clear topic sentences followed by supporting evidence.`,
        brdPrompt,
        true,
        32768
      );

      await ctx.runMutation(api.documents.store, {
        projectId,
        type: "brd",
        content: brdResult,
        generatedFrom: {
          requirementCount: updatedReqs.length,
          sourceCount: sources.length,
          stakeholderCount: stakeholders.length,
          decisionCount: brdDecisions.length,
        },
      });

      await logMsg("document_agent", "success", "✅ BRD generated successfully from structured intelligence");

      // ═══════════════════════════════════════════════════════════════════════
      // COMPLETE
      // ═══════════════════════════════════════════════════════════════════════
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "completed",
        sourcesProcessed: sources.length,
        requirementsFound: reqCounter,
        stakeholdersFound: extractedStakeholders.length,
        decisionsFound: decCounter,
        conflictsFound: brdConflicts.length,
      });

      await ctx.runMutation(api.projects.refreshCounts, { projectId });
      await ctx.runMutation(api.projects.update, {
        projectId,
        status: "active",
        progress: 100,
      });

      await logMsg("orchestrator", "success", `🎉 Pipeline complete! ${reqCounter} requirements, ${extractedStakeholders.length} stakeholders, ${decCounter} decisions extracted.`);
      await logMsg("orchestrator", "info", `📊 Total traceability links created. Knowledge graph ready.`);

      return {
        success: true,
        requirements: reqCounter,
        stakeholders: extractedStakeholders.length,
        decisions: decCounter,
        conflicts: brdConflicts.length,
      };
    } catch (error: any) {
      await logMsg("orchestrator", "error", `❌ Pipeline failed: ${error.message}`);
      await ctx.runMutation(api.pipeline.updateRunStatus, {
        runId,
        status: "failed",
        error: error.message,
      });
      await ctx.runMutation(api.projects.update, {
        projectId,
        status: "draft",
        progress: 0,
      });
      throw error;
    }
  },
});
