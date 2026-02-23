import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Projects ────────────────────────────────────────────────────────────
  projects: defineTable({
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("extracted"),
      v.literal("generating"),
      v.literal("active"),
      v.literal("completed")
    ),
    outputFormat: v.union(
      v.literal("brd"),
      v.literal("prd"),
      v.literal("both")
    ),
    color: v.string(),
    progress: v.number(),
    /** Creator / owner user — used for project-level access scoping */
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Aggregated stats (denormalized for speed)
    sourceCount: v.number(),
    requirementCount: v.number(),
    stakeholderCount: v.number(),
    decisionCount: v.number(),
    conflictCount: v.number(),
  }).index("by_user", ["userId"]),

  // ─── Sources (uploaded files / ingested data) ────────────────────────────
  sources: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    type: v.union(
      v.literal("email"),
      v.literal("meeting_transcript"),
      v.literal("chat_log"),
      v.literal("document"),
      v.literal("uploaded_file")
    ),
    content: v.string(),
    rawContent: v.optional(v.string()), // original unprocessed
    metadata: v.object({
      author: v.optional(v.string()),
      date: v.optional(v.string()),
      channel: v.optional(v.string()),
      subject: v.optional(v.string()),
      participants: v.optional(v.array(v.string())),
      wordCount: v.optional(v.number()),
      integrationAppId: v.optional(v.string()),
    }),
    status: v.union(
      v.literal("uploaded"),
      v.literal("classifying"),
      v.literal("classified"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("failed")
    ),
    relevanceScore: v.optional(v.number()), // 0-1 relevance to project
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_project", ["projectId"])
    .index("by_status", ["projectId", "status"]),

  // ─── Requirements (core intelligence) ────────────────────────────────────
  requirements: defineTable({
    projectId: v.id("projects"),
    requirementId: v.string(), // e.g., "REQ-001"
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("functional"),
      v.literal("non_functional"),
      v.literal("business"),
      v.literal("technical"),
      v.literal("security"),
      v.literal("performance"),
      v.literal("compliance"),
      v.literal("integration")
    ),
    priority: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    status: v.union(
      v.literal("discovered"),
      v.literal("pending"),
      v.literal("under_review"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("deferred")
    ),
    confidenceScore: v.number(), // 0-1
    // Source traceability
    sourceId: v.id("sources"),
    sourceExcerpt: v.string(),
    // Relationships
    stakeholderIds: v.array(v.id("stakeholders")),
    linkedRequirementIds: v.array(v.string()), // REQ-xxx references
    linkedDecisionIds: v.array(v.string()),
    // Metadata
    extractedAt: v.number(),
    lastModified: v.number(),
    modifiedBy: v.union(v.literal("ai"), v.literal("user")),
    // AI reasoning
    extractionReasoning: v.optional(v.string()),
    tags: v.array(v.string()),
  }).index("by_project", ["projectId"])
    .index("by_category", ["projectId", "category"])
    .index("by_priority", ["projectId", "priority"])
    .index("by_source", ["sourceId"]),

  // ─── Stakeholders ────────────────────────────────────────────────────────
  stakeholders: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    role: v.string(),
    department: v.optional(v.string()),
    influence: v.union(
      v.literal("decision_maker"),
      v.literal("influencer"),
      v.literal("contributor"),
      v.literal("observer")
    ),
    sentiment: v.optional(v.union(
      v.literal("supportive"),
      v.literal("neutral"),
      v.literal("resistant"),
      v.literal("unknown")
    )),
    mentionCount: v.number(),
    sourceIds: v.array(v.id("sources")),
    // Relationships — stakeholder ↔ stakeholder connections
    relatedStakeholderIds: v.array(v.id("stakeholders")),
    extractedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── Decisions ────────────────────────────────────────────────────────────
  decisions: defineTable({
    projectId: v.id("projects"),
    decisionId: v.string(), // "DEC-001"
    title: v.string(),
    description: v.string(),
    type: v.string(), // flexible — AI may produce varied categories
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("deferred")
    ),
    madeBy: v.optional(v.id("stakeholders")),
    sourceId: v.id("sources"),
    sourceExcerpt: v.string(),
    confidenceScore: v.number(),
    impactedRequirementIds: v.array(v.string()),
    extractedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── Timeline Events ─────────────────────────────────────────────────────
  timelineEvents: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    date: v.optional(v.string()),
    type: v.union(
      v.literal("milestone"),
      v.literal("deadline"),
      v.literal("decision"),
      v.literal("approval"),
      v.literal("dependency")
    ),
    sourceId: v.optional(v.id("sources")),
    confidenceScore: v.number(),
    extractedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── Conflicts (requirement contradictions) ───────────────────────────────
  conflicts: defineTable({
    projectId: v.id("projects"),
    conflictId: v.string(),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("major"),
      v.literal("minor")
    ),
    status: v.union(
      v.literal("detected"),
      v.literal("reviewing"),
      v.literal("resolved"),
      v.literal("accepted")
    ),
    requirementIds: v.array(v.id("requirements")),
    resolution: v.optional(v.string()),
    detectedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── Traceability Links (source ↔ requirement ↔ stakeholder graph) ──────
  traceabilityLinks: defineTable({
    projectId: v.id("projects"),
    fromType: v.union(
      v.literal("source"),
      v.literal("requirement"),
      v.literal("stakeholder"),
      v.literal("decision"),
      v.literal("conflict"),
      v.literal("timeline")
    ),
    fromId: v.string(), // Convex ID as string
    toType: v.union(
      v.literal("source"),
      v.literal("requirement"),
      v.literal("stakeholder"),
      v.literal("decision"),
      v.literal("conflict"),
      v.literal("timeline")
    ),
    toId: v.string(),
    relationship: v.string(), // "extracted_from", "proposed_by", "conflicts_with", etc.
    strength: v.number(), // 0-1
    createdAt: v.number(),
  }).index("by_project", ["projectId"])
    .index("by_from", ["fromType", "fromId"])
    .index("by_to", ["toType", "toId"]),

  // ─── Generated Documents ──────────────────────────────────────────────────
  documents: defineTable({
    projectId: v.id("projects"),
    type: v.union(v.literal("brd"), v.literal("prd"), v.literal("traceability_matrix")),
    version: v.number(),
    content: v.string(), // JSON string of structured document
    /** Parent document in the lineage chain (e.g. BRD → PRD → SRS) */
    parentDocumentId: v.optional(v.id("documents")),
    generatedAt: v.number(),
    generatedFrom: v.object({
      requirementCount: v.number(),
      sourceCount: v.number(),
      stakeholderCount: v.number(),
      decisionCount: v.number(),
    }),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("outdated")
    ),
  }).index("by_project", ["projectId"])
    .index("by_type", ["projectId", "type"])
    .index("by_parent", ["parentDocumentId"]),

  // ─── Extraction Runs (pipeline execution tracking) ────────────────────────
  extractionRuns: defineTable({
    projectId: v.id("projects"),
    status: v.union(
      v.literal("queued"),
      v.literal("ingesting"),
      v.literal("classifying"),
      v.literal("extracting_requirements"),
      v.literal("extracting_stakeholders"),
      v.literal("extracting_decisions"),
      v.literal("extracting_timeline"),
      v.literal("detecting_conflicts"),
      v.literal("building_traceability"),
      v.literal("generating_documents"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    sourcesProcessed: v.number(),
    requirementsFound: v.number(),
    stakeholdersFound: v.number(),
    decisionsFound: v.number(),
    conflictsFound: v.number(),
    error: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  // ─── Agent Logs (real-time pipeline activity) ─────────────────────────────
  agentLogs: defineTable({
    projectId: v.id("projects"),
    extractionRunId: v.id("extractionRuns"),
    agent: v.union(
      v.literal("ingestion_agent"),
      v.literal("classification_agent"),
      v.literal("requirement_agent"),
      v.literal("stakeholder_agent"),
      v.literal("decision_agent"),
      v.literal("timeline_agent"),
      v.literal("conflict_agent"),
      v.literal("traceability_agent"),
      v.literal("document_agent"),
      v.literal("orchestrator"),
      v.literal("integration_agent")
    ),
    level: v.union(
      v.literal("info"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    detail: v.optional(v.string()), // JSON stringified detail
    timestamp: v.number(),
  }).index("by_run", ["extractionRunId"])
    .index("by_project", ["projectId"]),

  // ─── User API Keys ───────────────────────────────────────────────────────
  apiKeys: defineTable({
    provider: v.union(
      v.literal("openai"),
      v.literal("gemini"),
      v.literal("anthropic"),
      v.literal("custom")
    ),
    keyHash: v.string(), // hashed, never store raw
    keyPreview: v.string(), // "sk-...abc"
    isActive: v.boolean(),
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
  }),

  // ─── System Settings ──────────────────────────────────────────────────────
  settings: defineTable({
    key: v.string(),
    value: v.string(), // JSON stringified
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ─── AI Chat Messages ─────────────────────────────────────────────────────
  chatMessages: defineTable({
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.object({
      provider: v.optional(v.string()),
      action: v.optional(v.string()), // "generate_brd", "modify_section", "review", "general"
      section: v.optional(v.string()),
    })),
    timestamp: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── App Integrations ─────────────────────────────────────────────────────
  integrations: defineTable({
    /** Which app: "slack", "jira", "notion", "github", "google_drive", etc. */
    appId: v.string(),
    /** Display name as entered by user */
    label: v.optional(v.string()),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("error"),
      v.literal("paused")
    ),
    /** OAuth / API token — in prod this would be in a vault */
    credentials: v.optional(v.object({
      accessToken: v.optional(v.string()),        // The actual API token for making requests
      tokenPreview: v.optional(v.string()),       // "xoxb-...abc" (masked display)
      scopes: v.optional(v.array(v.string())),
      expiresAt: v.optional(v.number()),
      connectionMethod: v.optional(v.string()),   // "oauth" | "api_token" | "import"
    })),
    /** Per-integration data scope — what the user chose to sync */
    dataScope: v.optional(v.object({
      channels: v.optional(v.array(v.string())),   // Slack channels, Teams channels
      repos: v.optional(v.array(v.string())),       // GitHub repos
      projects: v.optional(v.array(v.string())),    // Jira projects, Linear teams
      pages: v.optional(v.array(v.string())),       // Notion pages, Confluence spaces
      folders: v.optional(v.array(v.string())),     // Drive/Dropbox folders
      labels: v.optional(v.array(v.string())),      // Gmail labels
      dateRange: v.optional(v.object({
        from: v.optional(v.number()),
        to: v.optional(v.number()),
      })),
      includeComments: v.optional(v.boolean()),
      includeAttachments: v.optional(v.boolean()),
    })),
    /** Optional — link to a specific project */
    projectId: v.optional(v.id("projects")),
    /** Sync stats */
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
    itemsSynced: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_app", ["appId"])
    .index("by_project", ["projectId"])
    .index("by_status", ["status"]),

  // ─── Shared Links (public BRD sharing with access controls) ────────────────
  sharedLinks: defineTable({
    projectId: v.id("projects"),
    /** Unique share token (used in URL) */
    token: v.string(),
    /** Access level */
    permission: v.union(
      v.literal("view"),
      v.literal("comment"),
      v.literal("edit")
    ),
    /** Optional password protection */
    password: v.optional(v.string()),
    /** Optional expiration timestamp */
    expiresAt: v.optional(v.number()),
    /** Whether the link is active */
    isActive: v.boolean(),
    /** Creator info */
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    /** Access stats */
    accessCount: v.number(),
    lastAccessedAt: v.optional(v.number()),
  }).index("by_token", ["token"])
    .index("by_project", ["projectId"]),

  // ═══════════════════════════════════════════════════════════════════════════
  // STARTUP PHASE: Auth, Multi-tenancy, Document Chain
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Users (auth provider-synced user accounts) ─────────────────────────────
  users: defineTable({
    /** External auth provider ID (Logto sub, Clerk ID, etc.) — vendor-agnostic */
    authProviderId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    /** Which org this user belongs to */
    organizationId: v.optional(v.id("organizations")),
    /** Global role */
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    /** Onboarding status */
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  }).index("by_auth_provider_id", ["authProviderId"])
    .index("by_email", ["email"])
    .index("by_org", ["organizationId"]),

  // ─── Organizations (multi-tenancy) ─────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    /** Billing plan */
    plan: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("team"),
      v.literal("enterprise")
    ),
    /** Owner user */
    ownerId: v.optional(v.id("users")),
    memberCount: v.number(),
    /** Usage tracking */
    documentsGenerated: v.number(),
    aiTokensUsed: v.number(),
    storageUsedBytes: v.number(),
    /** Billing period */
    billingPeriodStart: v.optional(v.number()),
    billingPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  // ─── Document Types (the domino chain definition) ──────────────────────────
  documentTypes: defineTable({
    /** Short key: "brd", "prd", "frd", "srs", "trd", "test_plan", "uat", "rtm" */
    key: v.string(),
    /** Display name: "Business Requirements Document" */
    displayName: v.string(),
    /** Short label: "BRD" */
    shortLabel: v.string(),
    /** Position in the document chain (1 = first) */
    order: v.number(),
    /** Description of this document type */
    description: v.string(),
    /** Which document type must be completed before this one can be generated */
    requiredPredecessorKey: v.optional(v.string()),
    /** Which app integration categories are relevant for this doc type */
    integrationCategories: v.array(v.string()),
    /** JSON schema describing the sections of this document type */
    templateSections: v.array(v.object({
      key: v.string(),
      title: v.string(),
      description: v.string(),
      required: v.boolean(),
    })),
    /** Icon name from lucide */
    icon: v.string(),
    /** Theme color for UI */
    color: v.string(),
  }).index("by_key", ["key"])
    .index("by_order", ["order"]),

  // ─── Document Chain Links (connections between generated docs) ──────────────
  documentChainLinks: defineTable({
    projectId: v.id("projects"),
    /** The parent document that was used to generate this one */
    fromDocumentId: v.id("documents"),
    /** The child document generated from the parent */
    toDocumentId: v.id("documents"),
    /** Type of relationship */
    relationship: v.union(
      v.literal("generated_from"),
      v.literal("references"),
      v.literal("validates"),
      v.literal("traces_to")
    ),
    /** How many data points were inherited from parent → child */
    inheritedDataPoints: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_project", ["projectId"])
    .index("by_from", ["fromDocumentId"])
    .index("by_to", ["toDocumentId"]),

  // ─── Project Members (project-level RBAC) ──────────────────────────────────
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    addedAt: v.number(),
    addedBy: v.optional(v.id("users")),
  }).index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // ─── Audit Log (enterprise audit trail) ────────────────────────────────────
  auditLog: defineTable({
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    /** What happened */
    action: v.string(),
    /** What type of resource was affected */
    resourceType: v.union(
      v.literal("project"),
      v.literal("document"),
      v.literal("integration"),
      v.literal("user"),
      v.literal("organization"),
      v.literal("settings")
    ),
    /** ID of the affected resource */
    resourceId: v.optional(v.string()),
    /** Extra context as JSON string */
    metadata: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  // ─── Chat Context Settings (cross-project AI Chat access toggles) ────────────
  chatContextSettings: defineTable({
    /** The base project the AI Chat is opened in */
    projectId: v.id("projects"),
    /** The user who configured this */
    userId: v.id("users"),
    /** Additional projects the AI Chat is allowed to access */
    allowedProjectIds: v.array(v.id("projects")),
    updatedAt: v.number(),
  }).index("by_project_user", ["projectId", "userId"]),
});
