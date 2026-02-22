<div align="center">

# TraceLayer

### Agent-Based Requirements Intelligence Platform

**Automatically extract structured requirements from business communications and generate explainable, traceable BRD documents — powered by a multi-agent AI pipeline.**

[Live Demo](#getting-started) · [Architecture](#architecture) · [Tech Stack](#tech-stack)

</div>

---

## The Problem

Business requirements are buried across emails, meeting transcripts, Slack threads, and scattered documents. Manually synthesizing this information into a coherent BRD is:

- **Time-consuming** — weeks of analyst effort per project
- **Error-prone** — contradictions slip through, stakeholders get missed
- **Untraceable** — no link between final requirements and their source evidence

Existing tools either generate documents from raw text (no intelligence) or require tedious manual input.

## Our Solution

**TraceLayer doesn't just generate documents — it builds structured requirement intelligence first, then generates documents from it.**

This means every requirement, stakeholder mention, decision, and conflict is **extracted**, **classified**, **linked**, and **traceable** back to its source evidence with a confidence score.

### What Makes TraceLayer Different

| Traditional BRD Tools | TraceLayer |
|---|---|
| Text in → document out | Text in → **structured intelligence** → document out |
| No traceability | Full source-to-requirement traceability graph |
| Single AI call | **11-agent pipeline** with 9 extraction phases |
| Static output | Real-time knowledge graph with relationship mapping |
| Manual conflict review | Automated contradiction detection across requirements |
| Bring your own AI key | **AI agents provided** — zero configuration needed |

---

## Architecture

TraceLayer is built as a **layered intelligence system** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│  User Layer — React + Vite + TailwindCSS                │
│  Dashboard · BRD Viewer · Knowledge Graph · AI Chat     │
├─────────────────────────────────────────────────────────┤
│  API & Real-time Layer — Convex (serverless backend)    │
│  Queries · Mutations · Actions · Live subscriptions     │
├─────────────────────────────────────────────────────────┤
│  Integration Layer — 23 App Connectors                  │
│  Slack · GitHub · Jira · Gmail · Notion · Teams · ...   │
├─────────────────────────────────────────────────────────┤
│  Intelligence Layer — 11-Agent Extraction Pipeline      │
│  9 sequential phases with real-time progress tracking   │
├─────────────────────────────────────────────────────────┤
│  Storage Layer — 15 structured tables                   │
│  Projects · Requirements · Stakeholders · Traceability  │
└─────────────────────────────────────────────────────────┘
```

### Multi-Agent Extraction Pipeline (9 Phases)

Each pipeline run executes 9 sequential phases, each owned by a specialized AI agent:

| Phase | Agent | What It Does |
|---|---|---|
| 1 | **Orchestrator** | Coordinates pipeline lifecycle, manages state transitions |
| 2 | **Ingestion Agent** | Parses and loads source content (PDF, DOCX, text) |
| 3 | **Classification Agent** | Scores source relevance (0–1), detects type, identifies key topics |
| 4 | **Requirement Agent** | Deep extraction across 8 categories with confidence scoring |
| 5 | **Stakeholder Agent** | Maps people, influence levels, sentiment, and concerns |
| 6 | **Decision Agent** | Extracts confirmed decisions with rationale and status |
| 7 | **Timeline Agent** | Identifies milestones, deadlines, and dependencies |
| 8 | **Conflict Agent** | Detects contradictions between extracted requirements |
| 9 | **Traceability Agent** | Builds the knowledge graph linking all entities |

After all phases complete, the **Document Agent** generates a comprehensive BRD from the structured intelligence.

### Knowledge Graph

TraceLayer builds an interactive force-directed knowledge graph connecting **6 entity types**:

- Requirements ↔ Stakeholders ↔ Sources ↔ Decisions ↔ Conflicts ↔ Timeline Events

Each link has a **relationship type** and **strength score**, enabling full traceability from any requirement back to its source evidence.

---

## Key Features

### Intelligence & Extraction
- **11-agent AI pipeline** with 9 sequential extraction phases
- **8 requirement categories**: functional, non-functional, business, technical, security, performance, compliance, integration
- **Confidence scoring** on every extracted entity (0.0–1.0)
- **Automated conflict detection** between requirements
- **Stakeholder sentiment analysis**: supportive / neutral / resistant
- **3 AI providers** (managed by TraceLayer): OpenAI GPT-4o, Google Gemini 2.0 Flash, Anthropic Claude Sonnet

### Integrations (23 Apps)
Slack · GitHub · Jira · Notion · Confluence · Gmail · Google Docs · Google Drive · Figma · Discord · Microsoft Teams · Asana · Trello · Zoom · GitLab · Bitbucket · Monday.com · Coda · Dropbox · OneDrive · Outlook · Google Meet · Linear

Each integration has a **real API adapter** with OAuth/token support — not mock data.

### Visualization & Analysis
- **Interactive knowledge graph** (D3 force-directed, canvas-rendered)
- **Agent fleet dashboard** with live status indicators
- **Pipeline progress tracking** — real-time, agent-by-agent
- **Analytics charts** — requirement distribution, priority breakdown, stakeholder influence
- **Smart AI Insights** engine on the dashboard

### Document Generation & Export
- **Comprehensive BRD structure**: Executive Summary, Business Objectives, Scope Definition, Stakeholder Analysis, Functional/Non-Functional Analysis, Decision Analysis, Risk Assessment, Confidence Report
- **3 export formats**: PDF (print-optimized), Markdown, DOCX (Word)
- **Full source appendix** with traceability links

### AI Copilot
- **Global floating assistant** (Ctrl+J) accessible from any page
- **Context-aware** — understands current page and active project
- **Project chat** — trigger pipeline runs, ask questions about requirements, get AI summaries
- **Persistent conversation history** per project

### Platform
- **Real-time reactive** — all data updates live via Convex subscriptions
- **Dark/light theme** support
- **Responsive design** with resizable panels
- **Demo seeding** — one-click seed a full demo project with realistic data

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 6, TypeScript, TailwindCSS 4 |
| **UI Components** | Radix UI (25+ primitives), MUI Material, Lucide Icons |
| **Animations** | Framer Motion |
| **Charts** | Recharts (Pie, Bar) |
| **Knowledge Graph** | react-force-graph-2d + D3-force |
| **Backend** | Convex (real-time serverless — database, queries, mutations, actions) |
| **AI Providers** | OpenAI GPT-4o, Gemini 2.0 Flash, Claude Sonnet (platform-provided) |
| **File Parsing** | pdfjs-dist (PDF), mammoth (DOCX) |
| **Routing** | React Router 7 |
| **Forms** | react-hook-form + Zod validation |

---

## Database Schema (15 Tables)

| Table | Purpose |
|---|---|
| `projects` | Core project entity with status lifecycle |
| `sources` | Uploaded/ingested communication data |
| `requirements` | Extracted requirements with 8 categories, priorities, confidence |
| `stakeholders` | People with influence levels and sentiment |
| `decisions` | Extracted decisions with status workflow |
| `timelineEvents` | Milestones, deadlines, dependencies |
| `conflicts` | Requirement contradictions with severity |
| `traceabilityLinks` | Knowledge graph edges with relationship types and strength |
| `documents` | Generated BRD/PRD with versioning |
| `extractionRuns` | Pipeline execution tracking (13 status stages) |
| `agentLogs` | Real-time agent activity logs |
| `apiKeys` | Platform-managed AI provider keys (hashed) |
| `settings` | System key-value settings |
| `chatMessages` | Per-project AI chat history |
| `integrations` | App connections with OAuth credentials |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Convex](https://convex.dev) account (free tier works)
- No AI API keys required — TraceLayer provides the intelligence agents out of the box

### Setup

```bash
# Clone the repository
git clone https://github.com/Kshitijpalsinghtomar/TraceLayer.git
cd tracelayer/BRD

# Install dependencies
npm install

# Start Convex backend + Vite dev server
npx convex dev
# In another terminal:
npm run dev
```

### First Run

1. Open `http://localhost:5173`
2. Create a new project or click **"Seed Demo Project"** on the dashboard
4. Upload communication files (emails, meeting transcripts, chat logs — PDF/DOCX/TXT)
5. Open the project and click **"Analyze docs & generate BRD"**
6. Watch the 11-agent pipeline extract intelligence in real-time
7. View the generated BRD, explore the knowledge graph, and export

---

## Project Structure

```
BRD/
├── convex/               # Backend (Convex serverless functions)
│   ├── schema.ts         # 15-table database schema
│   ├── extraction.ts     # 11-agent extraction pipeline (core intelligence)
│   ├── pipeline.ts       # Pipeline management & logging
│   ├── integrationSync.ts# 23 real API adapters
│   ├── requirements.ts   # Requirement CRUD
│   ├── stakeholders.ts   # Stakeholder CRUD
│   ├── decisions.ts      # Decision CRUD
│   ├── conflicts.ts      # Conflict detection & resolution
│   ├── traceability.ts   # Knowledge graph links
│   ├── documents.ts      # BRD/PRD storage
│   ├── chat.ts           # AI chat mutations
│   ├── chatAction.ts     # AI chat actions (provider calls)
│   ├── copilot.ts        # AI copilot actions
│   └── demoSeed.ts       # Demo project seeder
├── src/
│   ├── main.tsx          # App entry point
│   └── app/
│       ├── App.tsx       # Root component with Convex provider
│       ├── routes.ts     # Route definitions
│       └── components/
│           ├── DashboardLive.tsx        # Agent Command Center dashboard
│           ├── BRDViewer.tsx            # BRD document viewer + editor
│           ├── KnowledgeGraph.tsx       # Force-directed traceability graph
│           ├── GraphExplorer.tsx        # Graph + analytics wrapper
│           ├── AgentPipelineView.tsx    # Pipeline control & monitoring
│           ├── AIChat.tsx              # Project AI chat interface
│           ├── AICopilot.tsx           # Global floating AI assistant
│           ├── ConflictResolutionView.tsx # Conflict management
│           ├── IntegrationsView.tsx     # 23-app integration manager
│           ├── ExportShareModal.tsx     # PDF/Markdown/DOCX export
│           ├── NotificationPanel.tsx    # Smart notification system
│           └── ...                     # 20+ additional components
└── package.json
```

---

## Impact

TraceLayer transforms what is traditionally a **weeks-long manual process** into an **automated, intelligent pipeline** that:

- **Reduces BRD creation time** from weeks → minutes
- **Eliminates missed requirements** through multi-source cross-referencing
- **Provides full traceability** — every requirement links back to source evidence
- **Detects conflicts automatically** — contradictions caught before they become costly
- **Democratizes BRD creation** — non-analysts can generate professional documents
- **Scales across tools** — 23 integrations mean requirements are captured wherever teams communicate

---

## License

MIT
