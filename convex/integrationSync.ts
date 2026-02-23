"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Integration Sync Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls data from connected integrations and converts them into project Sources
 * that the extraction pipeline can process.
 *
 * Architecture:
 *   Connected App → integrationSync.syncAll → sources.upload → pipeline
 *
 * Each adapter uses real API calls with the stored OAuth/API token.
 * If no token is available, the adapter returns a clear error.
 */

// ─── Per-App Adapters (real API calls) ───────────────────────────────────────

interface SyncedItem {
  name: string;
  type: "email" | "meeting_transcript" | "chat_log" | "document" | "uploaded_file";
  content: string;
  metadata: {
    author?: string;
    date?: string;
    channel?: string;
    subject?: string;
    participants?: string[];
    wordCount?: number;
    integrationAppId?: string;
  };
}

function buildScopeDescription(
  dataScope?: {
    channels?: string[];
    repos?: string[];
    projects?: string[];
    pages?: string[];
    folders?: string[];
    labels?: string[];
    dateRange?: { from?: number; to?: number };
    includeComments?: boolean;
    includeAttachments?: boolean;
  }
): string {
  if (!dataScope) return "Full sync (no scope filters)";
  const parts: string[] = [];
  if (dataScope.channels?.length) parts.push(`Channels: ${dataScope.channels.join(", ")}`);
  if (dataScope.repos?.length) parts.push(`Repos: ${dataScope.repos.join(", ")}`);
  if (dataScope.projects?.length) parts.push(`Projects: ${dataScope.projects.join(", ")}`);
  if (dataScope.pages?.length) parts.push(`Pages: ${dataScope.pages.join(", ")}`);
  if (dataScope.folders?.length) parts.push(`Folders: ${dataScope.folders.join(", ")}`);
  if (dataScope.labels?.length) parts.push(`Labels: ${dataScope.labels.join(", ")}`);
  if (dataScope.dateRange) {
    const from = dataScope.dateRange.from ? new Date(dataScope.dateRange.from).toLocaleDateString() : "start";
    const to = dataScope.dateRange.to ? new Date(dataScope.dateRange.to).toLocaleDateString() : "now";
    parts.push(`Date: ${from} → ${to}`);
  }
  if (dataScope.includeComments) parts.push("Including comments");
  if (dataScope.includeAttachments) parts.push("Including attachments");
  return parts.length ? parts.join(" | ") : "Full sync (no scope filters)";
}

/** 
 * Real API adapters — each calls the app's actual REST API using stored credentials.
 * Returns an array of SyncedItem ready for source ingestion.
 */

async function fetchWithAuth(url: string, token: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${res.statusText} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const APP_ADAPTERS: Record<string, (integration: any) => Promise<SyncedItem[]>> = {
  // ── Slack ───────────────────────────────────────────────────────────
  slack: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Slack API token configured. Add a Bot User OAuth Token from api.slack.com.");
    const channels = int.dataScope?.channels?.length ? int.dataScope.channels : [];

    // If no channels specified, list public channels first
    let channelIds: { id: string; name: string }[] = [];
    if (channels.length === 0) {
      const listRes = await fetchWithAuth("https://slack.com/api/conversations.list?types=public_channel&limit=5", token);
      if (listRes.ok) {
        channelIds = (listRes.channels || []).slice(0, 5).map((c: any) => ({ id: c.id, name: c.name }));
      }
    } else {
      // Search for channel by name
      const listRes = await fetchWithAuth("https://slack.com/api/conversations.list?types=public_channel&limit=100", token);
      if (listRes.ok) {
        for (const ch of channels) {
          const found = (listRes.channels || []).find((c: any) => c.name === ch.replace("#", ""));
          if (found) channelIds.push({ id: found.id, name: found.name });
        }
      }
    }

    const items: SyncedItem[] = [];
    for (const ch of channelIds) {
      const histRes = await fetchWithAuth(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=50`, token);
      if (histRes.ok && histRes.messages) {
        const msgText = histRes.messages
          .filter((m: any) => m.type === "message" && m.text)
          .map((m: any) => `[${new Date((m.ts || 0) * 1000).toISOString()}] ${m.text}`)
          .join("\n\n");
        items.push({
          name: `Slack — #${ch.name} messages`,
          type: "chat_log",
          content: msgText || `(No messages found in #${ch.name})`,
          metadata: { channel: ch.name, date: new Date().toISOString(), integrationAppId: "slack", wordCount: wordCount(msgText) },
        });
      }
    }
    return items.length ? items : [{ name: "Slack — No channels found", type: "chat_log", content: "No accessible channels found. Check your bot permissions.", metadata: { integrationAppId: "slack", wordCount: 8 } }];
  },

  // ── GitHub ──────────────────────────────────────────────────────────
  github: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No GitHub token configured. Create a Personal Access Token at github.com/settings/tokens.");
    const repos = int.dataScope?.repos?.length ? int.dataScope.repos : [];

    const items: SyncedItem[] = [];

    // If no repos specified, get user's recent repos
    let repoList = repos;
    if (repoList.length === 0) {
      const reposRes = await fetchWithAuth("https://api.github.com/user/repos?sort=updated&per_page=3", token);
      repoList = reposRes.map((r: any) => r.full_name);
    }

    for (const repo of repoList) {
      // Get recent issues
      try {
        const issues = await fetchWithAuth(`https://api.github.com/repos/${repo}/issues?state=all&per_page=20&sort=updated`, token);
        const issueText = issues.map((i: any) =>
          `### ${i.state === "open" ? "🟢" : "🔴"} #${i.number}: ${i.title}\n**Author:** ${i.user?.login || "unknown"} | **Labels:** ${(i.labels || []).map((l: any) => l.name).join(", ") || "none"} | **Created:** ${i.created_at}\n\n${i.body || "(no description)"}`
        ).join("\n\n---\n\n");
        items.push({
          name: `GitHub — ${repo} issues`,
          type: "document",
          content: `# Issues from ${repo}\n\n${issueText}`,
          metadata: { subject: `GitHub: ${repo}`, date: new Date().toISOString(), integrationAppId: "github", wordCount: wordCount(issueText) },
        });
      } catch (e) { /* skip if no access */ }

      // Get recent PRs
      try {
        const prs = await fetchWithAuth(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=10&sort=updated`, token);
        const prText = prs.map((p: any) =>
          `### ${p.state} PR #${p.number}: ${p.title}\n**Author:** ${p.user?.login || "unknown"} | **Base:** ${p.base?.ref} ← ${p.head?.ref}\n\n${p.body || "(no description)"}`
        ).join("\n\n---\n\n");
        if (prText) {
          items.push({
            name: `GitHub — ${repo} pull requests`,
            type: "document",
            content: `# Pull Requests from ${repo}\n\n${prText}`,
            metadata: { subject: `GitHub PRs: ${repo}`, date: new Date().toISOString(), integrationAppId: "github", wordCount: wordCount(prText) },
          });
        }
      } catch (e) { /* skip */ }
    }
    return items.length ? items : [{ name: "GitHub — No data", type: "document", content: "No accessible repositories found. Check your token permissions.", metadata: { integrationAppId: "github", wordCount: 8 } }];
  },

  // ── Notion ──────────────────────────────────────────────────────────
  notion: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Notion token configured. Create an integration at notion.so/my-integrations.");
    const targetPages = int.dataScope?.pages || [];

    const items: SyncedItem[] = [];

    // Search for pages
    const searchBody: any = { page_size: 10 };
    if (targetPages.length > 0) {
      searchBody.query = targetPages[0];
    }

    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
      body: JSON.stringify(searchBody),
    });
    if (!searchRes.ok) throw new Error(`Notion API ${searchRes.status}: ${await searchRes.text()}`);
    const data = await searchRes.json();

    for (const page of (data.results || []).slice(0, 10)) {
      if (page.object !== "page") continue;
      const title = page.properties?.title?.title?.[0]?.plain_text
        || page.properties?.Name?.title?.[0]?.plain_text
        || "Untitled";

      // Fetch page content (blocks)
      try {
        const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`, {
          headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
        });
        if (blocksRes.ok) {
          const blocksData = await blocksRes.json();
          const content = (blocksData.results || []).map((block: any) => {
            const type = block.type;
            const richText = block[type]?.rich_text || block[type]?.text || [];
            return richText.map((t: any) => t.plain_text || "").join("");
          }).filter(Boolean).join("\n\n");

          items.push({
            name: `Notion — ${title}`,
            type: "document",
            content: content || `(Page "${title}" has no text content)`,
            metadata: { subject: `Notion: ${title}`, date: new Date().toISOString(), integrationAppId: "notion", wordCount: wordCount(content) },
          });
        }
      } catch (e) { /* skip block fetch errors */ }
    }
    return items.length ? items : [{ name: "Notion — No pages found", type: "document", content: "No accessible pages found. Make sure the integration is added to the relevant pages.", metadata: { integrationAppId: "notion", wordCount: 14 } }];
  },

  // ── Jira ─────────────────────────────────────────────────────────────
  jira: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Jira API token. Create one at id.atlassian.com/manage-profile/security/api-tokens.");

    // Jira uses Basic auth with email:apiToken — token should be base64 encoded "email:token"
    const projects = int.dataScope?.projects?.length ? int.dataScope.projects : [];
    const items: SyncedItem[] = [];

    // We need the cloud domain — extract from token or use a default JQL search
    const jql = projects.length > 0
      ? `project in (${projects.map((p: string) => `"${p}"`).join(",")}) ORDER BY updated DESC`
      : "ORDER BY updated DESC";

    // Since we need the domain, we'll use the Jira Cloud REST API
    // The token should be formatted as "domain|email:apiToken" or just "email:apiToken"  
    const parts = token.split("|");
    const domain = parts.length > 1 ? parts[0] : null;
    const authToken = parts.length > 1 ? parts[1] : token;

    if (!domain) {
      return [{
        name: "Jira — Configuration needed",
        type: "document",
        content: "Jira token format: your-domain.atlassian.net|email@example.com:api_token\nPlease reconnect with the correct format.",
        metadata: { integrationAppId: "jira", wordCount: 15 },
      }];
    }

    try {
      const basicAuth = Buffer.from(authToken).toString("base64");
      const res = await fetch(`https://${domain}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,assignee,priority,description,labels,created,updated`, {
        headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
      const data = await res.json();

      const issueText = (data.issues || []).map((issue: any) => {
        const f = issue.fields || {};
        return `### ${f.status?.name || "?"} — ${issue.key}: ${f.summary}\n**Priority:** ${f.priority?.name || "?"} | **Assignee:** ${f.assignee?.displayName || "Unassigned"} | **Labels:** ${(f.labels || []).join(", ") || "none"}\n\n${f.description?.content?.map((c: any) => c.content?.map((t: any) => t.text || "").join("")).join("\n") || "(no description)"}`;
      }).join("\n\n---\n\n");

      items.push({
        name: `Jira — ${data.issues?.length || 0} issues`,
        type: "document",
        content: `# Jira Issues\n\n${issueText}`,
        metadata: { subject: "Jira Issues", date: new Date().toISOString(), integrationAppId: "jira", wordCount: wordCount(issueText) },
      });
    } catch (e: any) {
      items.push({ name: "Jira — Sync error", type: "document", content: `Failed to sync Jira: ${e.message}`, metadata: { integrationAppId: "jira", wordCount: 10 } });
    }

    return items;
  },

  // ── Linear ────────────────────────────────────────────────────────────
  linear: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Linear API key. Create one at linear.app/settings/api.");

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ issues(first: 25, orderBy: updatedAt) { nodes { identifier title state { name } priority assignee { name } description labels { nodes { name } } createdAt } } }`,
      }),
    });
    if (!res.ok) throw new Error(`Linear API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const issues = data?.data?.issues?.nodes || [];

    const issueText = issues.map((i: any) =>
      `### ${i.state?.name || "?"} — ${i.identifier}: ${i.title}\n**Priority:** ${i.priority} | **Assignee:** ${i.assignee?.name || "Unassigned"} | **Labels:** ${(i.labels?.nodes || []).map((l: any) => l.name).join(", ") || "none"}\n\n${i.description || "(no description)"}`
    ).join("\n\n---\n\n");

    return [{
      name: `Linear — ${issues.length} issues`,
      type: "document",
      content: `# Linear Issues\n\n${issueText || "(No issues found)"}`,
      metadata: { subject: "Linear Issues", date: new Date().toISOString(), integrationAppId: "linear", wordCount: wordCount(issueText) },
    }];
  },

  // ── Confluence ──────────────────────────────────────────────────────
  confluence: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Confluence token. Format: domain.atlassian.net|email:api_token");

    const parts = token.split("|");
    if (parts.length < 2) throw new Error("Token format: domain.atlassian.net|email:api_token");
    const domain = parts[0];
    const basicAuth = Buffer.from(parts[1]).toString("base64");

    const res = await fetch(`https://${domain}/wiki/rest/api/content?limit=10&expand=body.storage,space`, {
      headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Confluence ${res.status}: ${await res.text()}`);
    const data = await res.json();

    return (data.results || []).map((page: any) => {
      const htmlContent = page.body?.storage?.value || "";
      // Strip HTML tags for plain text
      const text = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return {
        name: `Confluence — ${page.title}`,
        type: "document" as const,
        content: text || `(Page "${page.title}" is empty)`,
        metadata: { subject: `Confluence: ${page.title}`, date: new Date().toISOString(), integrationAppId: "confluence", wordCount: wordCount(text) },
      };
    });
  },

  // ── Google Docs / Drive ─────────────────────────────────────────────
  google_docs: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Google OAuth token. Connect via OAuth to get an access token from console.cloud.google.com.");

    const res = await fetchWithAuth("https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application/vnd.google-apps.document'&pageSize=10&fields=files(id,name,modifiedTime)", token);
    const items: SyncedItem[] = [];

    for (const file of (res.files || []).slice(0, 10)) {
      try {
        const docRes = await fetchWithAuth(`https://docs.googleapis.com/v1/documents/${file.id}`, token);
        const text = (docRes.body?.content || [])
          .flatMap((s: any) => (s.paragraph?.elements || []))
          .map((e: any) => e.textRun?.content || "")
          .join("");
        items.push({
          name: `Google Docs — ${file.name}`,
          type: "document",
          content: text || `(Document "${file.name}" is empty)`,
          metadata: { subject: `GDocs: ${file.name}`, date: file.modifiedTime || new Date().toISOString(), integrationAppId: "google_docs", wordCount: wordCount(text) },
        });
      } catch { /* skip individual doc errors */ }
    }
    return items.length ? items : [{ name: "Google Docs — No documents", type: "document", content: "No accessible documents found.", metadata: { integrationAppId: "google_docs", wordCount: 4 } }];
  },

  google_drive: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Google OAuth token. Connect via OAuth from console.cloud.google.com.");
    const folders = int.dataScope?.folders || [];

    let query = "trashed=false";
    if (folders.length > 0) query += ` and name contains '${folders[0]}'`;

    const res = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=10&fields=files(id,name,mimeType,modifiedTime,size)`, token);

    return (res.files || []).map((file: any) => ({
      name: `Google Drive — ${file.name}`,
      type: "uploaded_file" as const,
      content: `File: ${file.name}\nType: ${file.mimeType}\nSize: ${file.size || "unknown"} bytes\nModified: ${file.modifiedTime}`,
      metadata: { subject: `Drive: ${file.name}`, date: file.modifiedTime || new Date().toISOString(), integrationAppId: "google_drive", wordCount: 10 },
    }));
  },

  // ── Figma ───────────────────────────────────────────────────────────
  figma: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Figma token. Create a Personal Access Token at figma.com/developers/api.");

    const res = await fetch("https://api.figma.com/v1/me/files?page_size=10", {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
    // Figma doesn't have a direct "list files" endpoint for personal tokens
    // Instead we use the /me endpoint and then fetch team projects
    const meRes = await fetch("https://api.figma.com/v1/me", {
      headers: { "X-Figma-Token": token },
    });
    if (!meRes.ok) throw new Error(`Figma ${meRes.status}`);
    const me = await meRes.json();

    return [{
      name: `Figma — ${me.handle || "User"}'s files`,
      type: "document",
      content: `Connected as ${me.handle || me.email || "unknown"} (${me.email || ""}). Use the Figma file key to sync specific design files. User ID: ${me.id}`,
      metadata: { subject: "Figma Account", date: new Date().toISOString(), integrationAppId: "figma", wordCount: 20 },
    }];
  },

  // ── Gmail ────────────────────────────────────────────────────────────
  gmail: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Gmail OAuth token. Connect via Google OAuth from console.cloud.google.com.");
    const labels = int.dataScope?.labels || [];

    let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10";
    if (labels.length > 0) url += `&labelIds=${labels.join(",")}`;

    const listRes = await fetchWithAuth(url, token);
    const items: SyncedItem[] = [];

    for (const msg of (listRes.messages || []).slice(0, 10)) {
      try {
        const detail = await fetchWithAuth(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, token);
        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
        const from = headers.find((h: any) => h.name === "From")?.value || "";
        const date = headers.find((h: any) => h.name === "Date")?.value || "";

        // Extract body text
        let body = "";
        if (detail.payload?.body?.data) {
          body = Buffer.from(detail.payload.body.data, "base64url").toString("utf-8");
        } else if (detail.payload?.parts) {
          const textPart = detail.payload.parts.find((p: any) => p.mimeType === "text/plain");
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
          }
        }

        items.push({
          name: `Gmail — ${subject}`,
          type: "email",
          content: `From: ${from}\nDate: ${date}\nSubject: ${subject}\n\n${body}`,
          metadata: { subject, author: from, date, integrationAppId: "gmail", wordCount: wordCount(body) },
        });
      } catch { /* skip individual message errors */ }
    }
    return items.length ? items : [{ name: "Gmail — No emails", type: "email", content: "No accessible emails found.", metadata: { integrationAppId: "gmail", wordCount: 4 } }];
  },

  // ── Discord ─────────────────────────────────────────────────────────
  discord: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Discord Bot token. Create a bot at discord.com/developers/applications.");
    const channels = int.dataScope?.channels || [];

    const items: SyncedItem[] = [];
    // If channels specified by ID, fetch messages directly
    for (const ch of channels.slice(0, 5)) {
      try {
        const msgs = await fetchWithAuth(`https://discord.com/api/v10/channels/${ch}/messages?limit=50`, token, { Authorization: `Bot ${token}` });
        const msgText = msgs.map((m: any) => `[${m.timestamp}] ${m.author?.username || "?"}: ${m.content}`).join("\n\n");
        items.push({
          name: `Discord — Channel ${ch}`,
          type: "chat_log",
          content: msgText || "(No messages)",
          metadata: { channel: ch, date: new Date().toISOString(), integrationAppId: "discord", wordCount: wordCount(msgText) },
        });
      } catch { /* skip */ }
    }

    if (items.length === 0) {
      return [{ name: "Discord — Provide channel IDs", type: "chat_log", content: "Add Discord channel IDs in the scope settings to sync messages.", metadata: { integrationAppId: "discord", wordCount: 12 } }];
    }
    return items;
  },

  // ── Microsoft Teams ─────────────────────────────────────────────────
  ms_teams: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Microsoft Graph token. Register an app at portal.azure.com.");

    try {
      const teamsRes = await fetchWithAuth("https://graph.microsoft.com/v1.0/me/joinedTeams", token);
      const items: SyncedItem[] = [];

      for (const team of (teamsRes.value || []).slice(0, 3)) {
        const channelsRes = await fetchWithAuth(`https://graph.microsoft.com/v1.0/teams/${team.id}/channels`, token);
        for (const channel of (channelsRes.value || []).slice(0, 2)) {
          try {
            const msgsRes = await fetchWithAuth(`https://graph.microsoft.com/v1.0/teams/${team.id}/channels/${channel.id}/messages?$top=20`, token);
            const msgText = (msgsRes.value || []).map((m: any) => `[${m.createdDateTime}] ${m.from?.user?.displayName || "?"}: ${m.body?.content || ""}`).join("\n\n");
            items.push({
              name: `Teams — ${team.displayName}/${channel.displayName}`,
              type: "chat_log",
              content: msgText || "(No messages)",
              metadata: { channel: channel.displayName, date: new Date().toISOString(), integrationAppId: "ms_teams", wordCount: wordCount(msgText) },
            });
          } catch { /* skip */ }
        }
      }
      return items.length ? items : [{ name: "Teams — No data", type: "chat_log", content: "No accessible teams/channels.", metadata: { integrationAppId: "ms_teams", wordCount: 4 } }];
    } catch (e: any) {
      return [{ name: "Teams — Error", type: "chat_log", content: `Teams sync failed: ${e.message}`, metadata: { integrationAppId: "ms_teams", wordCount: 6 } }];
    }
  },

  // ── Asana ───────────────────────────────────────────────────────────
  asana: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Asana token. Create a Personal Access Token at app.asana.com/-/developer_console.");

    const projectsRes = await fetchWithAuth("https://app.asana.com/api/1.0/projects?limit=5&opt_fields=name", token);
    const items: SyncedItem[] = [];

    for (const proj of (projectsRes.data || []).slice(0, 5)) {
      const tasksRes = await fetchWithAuth(`https://app.asana.com/api/1.0/projects/${proj.gid}/tasks?limit=25&opt_fields=name,notes,assignee.name,completed,due_on,tags.name`, token);
      const taskText = (tasksRes.data || []).map((t: any) =>
        `### ${t.completed ? "✅" : "⬜"} ${t.name}\n**Assignee:** ${t.assignee?.name || "Unassigned"} | **Due:** ${t.due_on || "none"}\n\n${t.notes || "(no notes)"}`
      ).join("\n\n---\n\n");
      items.push({
        name: `Asana — ${proj.name}`,
        type: "document",
        content: `# ${proj.name}\n\n${taskText || "(No tasks)"}`,
        metadata: { subject: `Asana: ${proj.name}`, date: new Date().toISOString(), integrationAppId: "asana", wordCount: wordCount(taskText) },
      });
    }
    return items.length ? items : [{ name: "Asana — No projects", type: "document", content: "No accessible projects found.", metadata: { integrationAppId: "asana", wordCount: 4 } }];
  },

  // ── Trello ──────────────────────────────────────────────────────────
  trello: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Trello token. Get API key + token from trello.com/app-key.");

    // Token format: "apiKey|token"
    const parts = token.split("|");
    if (parts.length < 2) throw new Error("Trello token format: apiKey|oauthToken");
    const [apiKey, oauthToken] = parts;

    const boardsRes = await fetch(`https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${oauthToken}&fields=name`);
    if (!boardsRes.ok) throw new Error(`Trello ${boardsRes.status}`);
    const boards = await boardsRes.json();

    const items: SyncedItem[] = [];
    for (const board of boards.slice(0, 5)) {
      const cardsRes = await fetch(`https://api.trello.com/1/boards/${board.id}/cards?key=${apiKey}&token=${oauthToken}&fields=name,desc,labels,due,closed`);
      if (!cardsRes.ok) continue;
      const cards = await cardsRes.json();
      const cardText = cards.map((c: any) =>
        `### ${c.closed ? "📁" : "📋"} ${c.name}\n**Labels:** ${(c.labels || []).map((l: any) => l.name).join(", ") || "none"} | **Due:** ${c.due || "none"}\n\n${c.desc || "(no description)"}`
      ).join("\n\n---\n\n");
      items.push({
        name: `Trello — ${board.name}`,
        type: "document",
        content: `# ${board.name}\n\n${cardText || "(No cards)"}`,
        metadata: { subject: `Trello: ${board.name}`, date: new Date().toISOString(), integrationAppId: "trello", wordCount: wordCount(cardText) },
      });
    }
    return items.length ? items : [{ name: "Trello — No boards", type: "document", content: "No accessible boards.", metadata: { integrationAppId: "trello", wordCount: 3 } }];
  },

  // ── Zoom ────────────────────────────────────────────────────────────
  zoom: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Zoom OAuth token. Register an app at marketplace.zoom.us.");

    const meetingsRes = await fetchWithAuth("https://api.zoom.us/v2/users/me/meetings?type=previous_meetings&page_size=10", token);
    const items: SyncedItem[] = [];

    for (const meeting of (meetingsRes.meetings || []).slice(0, 10)) {
      items.push({
        name: `Zoom — ${meeting.topic || "Meeting"}`,
        type: "meeting_transcript",
        content: `Meeting: ${meeting.topic}\nDate: ${meeting.start_time}\nDuration: ${meeting.duration} min\nParticipants: ${meeting.total_minutes || "?"} total minutes`,
        metadata: {
          subject: meeting.topic,
          date: meeting.start_time,
          participants: [],
          integrationAppId: "zoom",
          wordCount: 15,
        },
      });
    }
    return items.length ? items : [{ name: "Zoom — No meetings", type: "meeting_transcript", content: "No recent meetings found.", metadata: { integrationAppId: "zoom", wordCount: 4 } }];
  },

  // ── Generic adapters for remaining apps ─────────────────────────────
  gitlab: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No GitLab token. Create a Personal Access Token at gitlab.com/-/user_settings/personal_access_tokens.");
    const repos = int.dataScope?.repos || [];

    const items: SyncedItem[] = [];
    const projectsRes = await fetch(`https://gitlab.com/api/v4/projects?membership=true&per_page=5&order_by=updated_at`, {
      headers: { "PRIVATE-TOKEN": token },
    });
    if (!projectsRes.ok) throw new Error(`GitLab ${projectsRes.status}`);
    const projects = await projectsRes.json();

    for (const proj of projects.slice(0, 5)) {
      const issuesRes = await fetch(`https://gitlab.com/api/v4/projects/${proj.id}/issues?per_page=20&state=all`, {
        headers: { "PRIVATE-TOKEN": token },
      });
      if (!issuesRes.ok) continue;
      const issues = await issuesRes.json();
      const issueText = issues.map((i: any) =>
        `### ${i.state} — #${i.iid}: ${i.title}\n**Author:** ${i.author?.name || "?"} | **Labels:** ${(i.labels || []).join(", ") || "none"}\n\n${i.description || "(no description)"}`
      ).join("\n\n---\n\n");
      items.push({
        name: `GitLab — ${proj.path_with_namespace}`,
        type: "document",
        content: `# ${proj.name} Issues\n\n${issueText}`,
        metadata: { subject: `GitLab: ${proj.name}`, date: new Date().toISOString(), integrationAppId: "gitlab", wordCount: wordCount(issueText) },
      });
    }
    return items.length ? items : [{ name: "GitLab — No projects", type: "document", content: "No accessible projects.", metadata: { integrationAppId: "gitlab", wordCount: 3 } }];
  },

  bitbucket: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Bitbucket App Password. Create one at bitbucket.org/account/settings/app-passwords/. Format: username|app_password");
    const parts = token.split("|");
    if (parts.length < 2) throw new Error("Format: username|app_password");
    const basicAuth = Buffer.from(parts.join(":")).toString("base64");

    const res = await fetch("https://api.bitbucket.org/2.0/repositories?role=member&pagelen=5&sort=-updated_on", {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!res.ok) throw new Error(`Bitbucket ${res.status}`);
    const data = await res.json();

    return (data.values || []).map((repo: any) => ({
      name: `Bitbucket — ${repo.full_name}`,
      type: "document" as const,
      content: `Repository: ${repo.full_name}\nDescription: ${repo.description || "(none)"}\nLanguage: ${repo.language || "?"}\nUpdated: ${repo.updated_on}`,
      metadata: { subject: `Bitbucket: ${repo.full_name}`, date: new Date().toISOString(), integrationAppId: "bitbucket", wordCount: 15 },
    }));
  },

  monday: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Monday.com API token. Get it from monday.com — Admin > API.");

    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ boards(limit:5) { id name items_page(limit:20) { items { id name column_values { text } } } } }" }),
    });
    if (!res.ok) throw new Error(`Monday ${res.status}`);
    const data = await res.json();

    return (data.data?.boards || []).map((board: any) => {
      const itemText = (board.items_page?.items || []).map((i: any) =>
        `- ${i.name}: ${(i.column_values || []).map((c: any) => c.text).filter(Boolean).join(" | ")}`
      ).join("\n");
      return {
        name: `Monday — ${board.name}`,
        type: "document" as const,
        content: `# ${board.name}\n\n${itemText || "(No items)"}`,
        metadata: { subject: `Monday: ${board.name}`, date: new Date().toISOString(), integrationAppId: "monday", wordCount: wordCount(itemText) },
      };
    });
  },

  coda: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Coda API token. Generate one at coda.io/account#apiSettings.");

    const res = await fetchWithAuth("https://coda.io/apis/v1/docs?limit=10", token);
    return (res.items || []).map((doc: any) => ({
      name: `Coda — ${doc.name}`,
      type: "document" as const,
      content: `Document: ${doc.name}\nOwner: ${doc.owner}\nCreated: ${doc.createdAt}\nFolder: ${doc.folder?.name || "/"}`,
      metadata: { subject: `Coda: ${doc.name}`, date: doc.updatedAt || new Date().toISOString(), integrationAppId: "coda", wordCount: 10 },
    }));
  },

  dropbox: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Dropbox OAuth token. Register at dropbox.com/developers/apps.");
    const folders = int.dataScope?.folders || [];
    const path = folders.length > 0 ? folders[0] : "";

    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path, limit: 20 }),
    });
    if (!res.ok) throw new Error(`Dropbox ${res.status}: ${await res.text()}`);
    const data = await res.json();

    return (data.entries || []).map((entry: any) => ({
      name: `Dropbox — ${entry.name}`,
      type: "uploaded_file" as const,
      content: `File: ${entry.path_display}\nType: ${entry[".tag"]}\nSize: ${entry.size || "folder"}\nModified: ${entry.server_modified || "N/A"}`,
      metadata: { subject: `Dropbox: ${entry.name}`, date: entry.server_modified || new Date().toISOString(), integrationAppId: "dropbox", wordCount: 10 },
    }));
  },

  onedrive: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No OneDrive/Microsoft Graph token. Register an app at portal.azure.com.");

    const res = await fetchWithAuth("https://graph.microsoft.com/v1.0/me/drive/root/children?$top=20", token);
    return (res.value || []).map((item: any) => ({
      name: `OneDrive — ${item.name}`,
      type: "uploaded_file" as const,
      content: `File: ${item.name}\nSize: ${item.size} bytes\nModified: ${item.lastModifiedDateTime}\nType: ${item.file?.mimeType || "folder"}`,
      metadata: { subject: `OneDrive: ${item.name}`, date: item.lastModifiedDateTime || new Date().toISOString(), integrationAppId: "onedrive", wordCount: 10 },
    }));
  },

  outlook: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Outlook/Microsoft Graph token. Register an app at portal.azure.com.");

    const res = await fetchWithAuth("https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=subject,from,receivedDateTime,bodyPreview", token);
    return (res.value || []).map((msg: any) => ({
      name: `Outlook — ${msg.subject || "(no subject)"}`,
      type: "email" as const,
      content: `From: ${msg.from?.emailAddress?.address || "?"}\nDate: ${msg.receivedDateTime}\nSubject: ${msg.subject}\n\n${msg.bodyPreview || ""}`,
      metadata: { subject: msg.subject, author: msg.from?.emailAddress?.address, date: msg.receivedDateTime, integrationAppId: "outlook", wordCount: wordCount(msg.bodyPreview || "") },
    }));
  },

  google_meet: async (int) => {
    const token = int.credentials?.accessToken;
    if (!token) throw new Error("No Google OAuth token. Google Meet transcripts require Google Workspace and Calendar API access.");

    // Google Meet doesn't have a direct API; use Calendar to find meetings
    const now = new Date().toISOString();
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetchWithAuth(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${oneMonthAgo}&timeMax=${now}&maxResults=10&q=meet.google.com`, token);

    return (res.items || []).map((event: any) => ({
      name: `Google Meet — ${event.summary || "Meeting"}`,
      type: "meeting_transcript" as const,
      content: `Meeting: ${event.summary || "Untitled"}\nDate: ${event.start?.dateTime || event.start?.date}\nAttendees: ${(event.attendees || []).map((a: any) => a.email).join(", ")}\nLink: ${event.hangoutLink || "N/A"}\n\nDescription: ${event.description || "(none)"}`,
      metadata: {
        subject: event.summary,
        date: event.start?.dateTime,
        participants: (event.attendees || []).map((a: any) => a.email),
        integrationAppId: "google_meet",
        wordCount: 15,
      },
    }));
  },
};

// ─── Sync a single integration to a project ─────────────────────────────────
export const syncIntegration = action({
  args: {
    integrationId: v.string(),
    appId: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; itemsSynced: number; error?: string }> => {
    try {
      // Get the integration data
      const integration = await ctx.runQuery(api.integrations.getByApp, { appId: args.appId });
      if (!integration || integration.status !== "connected") {
        return { success: false, itemsSynced: 0, error: `Integration ${args.appId} not connected` };
      }

      // Get the adapter
      const adapter = APP_ADAPTERS[args.appId];
      if (!adapter) {
        // Generic fallback for unknown apps
        const item: SyncedItem = {
          name: `${args.appId} — synced data`,
          type: "document",
          content: `No dedicated adapter for "${args.appId}". Configure scope settings and ensure API credentials are valid.`,
          metadata: {
            subject: args.appId,
            date: new Date().toISOString(),
            integrationAppId: args.appId,
            wordCount: 15,
          },
        };
        await ctx.runMutation(api.sources.upload, {
          projectId: args.projectId,
          name: item.name,
          type: item.type,
          content: item.content,
          metadata: item.metadata,
        });
        await ctx.runMutation(api.integrations.recordSync, {
          integrationId: integration._id,
          status: "success",
          itemsSynced: 1,
        });
        return { success: true, itemsSynced: 1 };
      }

      // Run the adapter (all adapters are now async)
      const items = await adapter(integration);

      // Upload each item as a source
      for (const item of items) {
        await ctx.runMutation(api.sources.upload, {
          projectId: args.projectId,
          name: item.name,
          type: item.type,
          content: item.content,
          metadata: item.metadata,
        });
      }

      // Record sync
      await ctx.runMutation(api.integrations.recordSync, {
        integrationId: integration._id,
        status: "success",
        itemsSynced: items.length,
      });

      return { success: true, itemsSynced: items.length };
    } catch (error: any) {
      return { success: false, itemsSynced: 0, error: error.message };
    }
  },
});

// ─── Sync ALL connected integrations to a project ───────────────────────────
export const syncAllToProject = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    totalItemsSynced: number;
    results: Array<{ appId: string; itemsSynced: number; error?: string }>;
  }> => {
    // Get all connected integrations
    const integrations: any[] = await ctx.runQuery(api.integrations.list, {});
    const connected = integrations.filter(
      (i) => i.status === "connected"
    );

    if (connected.length === 0) {
      return { success: true, totalItemsSynced: 0, results: [] };
    }

    const results: Array<{ appId: string; itemsSynced: number; error?: string }> = [];
    let totalItemsSynced = 0;

    for (const integration of connected) {
      const result = await ctx.runAction(api.integrationSync.syncIntegration, {
        integrationId: integration._id,
        appId: integration.appId,
        projectId: args.projectId,
      });
      results.push({ appId: integration.appId, itemsSynced: result.itemsSynced, error: result.error });
      totalItemsSynced += result.itemsSynced;
    }

    return { success: true, totalItemsSynced, results };
  },
});

// ─── Sync integrations + immediately run pipeline ────────────────────────────
export const syncAndRunPipeline = action({
  args: {
    projectId: v.id("projects"),
    regenerate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    // Step 1: Sync all connected integrations
    const syncResult = await ctx.runAction(api.integrationSync.syncAllToProject, {
      projectId: args.projectId,
    });

    // Step 2: Run the extraction pipeline (provider/apiKey resolved internally)
    const pipelineResult = await ctx.runAction(api.extraction.runExtractionPipeline, {
      projectId: args.projectId,
      regenerate: args.regenerate,
    });

    return {
      sync: syncResult,
      pipeline: pipelineResult,
    };
  },
});
