/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentKnowledge from "../agentKnowledge.js";
import type * as apiKeys from "../apiKeys.js";
import type * as chat from "../chat.js";
import type * as chatAction from "../chatAction.js";
import type * as chatContextSettings from "../chatContextSettings.js";
import type * as conflicts from "../conflicts.js";
import type * as copilot from "../copilot.js";
import type * as decisions from "../decisions.js";
import type * as demoSeed from "../demoSeed.js";
import type * as documentTypesSeed from "../documentTypesSeed.js";
import type * as documents from "../documents.js";
import type * as extraction from "../extraction.js";
import type * as insights from "../insights.js";
import type * as integrationSync from "../integrationSync.js";
import type * as integrations from "../integrations.js";
import type * as pipeline from "../pipeline.js";
import type * as projects from "../projects.js";
import type * as requirements from "../requirements.js";
import type * as settings from "../settings.js";
import type * as sharing from "../sharing.js";
import type * as sources from "../sources.js";
import type * as stakeholders from "../stakeholders.js";
import type * as timeline from "../timeline.js";
import type * as traceability from "../traceability.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentKnowledge: typeof agentKnowledge;
  apiKeys: typeof apiKeys;
  chat: typeof chat;
  chatAction: typeof chatAction;
  chatContextSettings: typeof chatContextSettings;
  conflicts: typeof conflicts;
  copilot: typeof copilot;
  decisions: typeof decisions;
  demoSeed: typeof demoSeed;
  documentTypesSeed: typeof documentTypesSeed;
  documents: typeof documents;
  extraction: typeof extraction;
  insights: typeof insights;
  integrationSync: typeof integrationSync;
  integrations: typeof integrations;
  pipeline: typeof pipeline;
  projects: typeof projects;
  requirements: typeof requirements;
  settings: typeof settings;
  sharing: typeof sharing;
  sources: typeof sources;
  stakeholders: typeof stakeholders;
  timeline: typeof timeline;
  traceability: typeof traceability;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
