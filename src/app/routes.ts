import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { DashboardLive } from './components/DashboardLive';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { AgentPipelineView } from './components/AgentPipelineView';
import { BRDViewer } from './components/BRDViewer';
import { NewProject } from './components/NewProject';
import { ProjectsListView } from './components/ProjectsListView';
import { GraphExplorer } from './components/GraphExplorer';
import { SettingsView } from './components/SettingsView';
import { HelpView } from './components/HelpView';
import { IntegrationsView } from './components/IntegrationsView';
import { AISettingsView } from './components/AISettingsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DecisionsView } from './components/DecisionsView';
import { SourcesView } from './components/SourcesView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { ControlCenterPage } from './components/ControlCenterPage';
import { AdminPage } from './components/AdminPage';
import { ConflictResolutionView } from './components/ConflictResolutionView';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: DashboardLive },
      { path: 'projects', Component: ProjectsListView },
      { path: 'projects/new', Component: NewProject },
      { path: 'projects/:projectId', Component: ProjectWorkspace },
      { path: 'projects/:projectId/pipeline', Component: AgentPipelineView },
      { path: 'projects/:projectId/controls', Component: ControlCenterPage },
      { path: 'projects/:projectId/brd', Component: BRDViewer },
      { path: 'projects/:projectId/graph', Component: GraphExplorer },
      { path: 'projects/:projectId/analytics', Component: AnalyticsView },
      { path: 'projects/:projectId/conflicts', Component: ConflictResolutionView },
      { path: 'projects/:projectId/decisions', Component: DecisionsView },
      { path: 'projects/:projectId/sources', Component: SourcesView },
      { path: 'settings', Component: SettingsView },
      { path: 'help', Component: HelpView },
      { path: 'integrations', Component: IntegrationsView },
      { path: 'ai-settings', Component: AISettingsView },
      { path: 'search', Component: SearchView },
      { path: 'profile', Component: ProfileView },
      { path: 'admin', Component: AdminPage },
    ],
  },
]);
