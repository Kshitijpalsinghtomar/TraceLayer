import { createBrowserRouter } from 'react-router';
import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import { DashboardLive } from './components/DashboardLive';
import { ProjectWorkspace } from './components/ProjectWorkspace';
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
import { AdminPage } from './components/AdminPage';
import { ConflictResolutionView } from './components/ConflictResolutionView';
import { SharedBRDView } from './components/SharedBRDView';
import { SignInPage } from './components/SignInPage';
import { SignUpPage } from './components/SignUpPage';
import { CallbackPage } from './components/CallbackPage';
import { AuthGuard } from './components/AuthGuard';
import { AuthErrorBoundary } from './components/AuthErrorBoundary';
import { DocumentChainView } from './components/DocumentChainView';
import { AdminGuard } from './components/AdminGuard';

/**
 * ProtectedLayout wraps AuthGuard → Layout.
 * AuthGuard renders <Outlet /> when authenticated,
 * so Layout becomes the rendered child.
 */
function ProtectedLayout() {
  return (
    <AuthErrorBoundary>
      <AuthGuard />
    </AuthErrorBoundary>
  );
}

export const router = createBrowserRouter([
  // ─── Public routes (no auth required) ──────────────────────────────────
  {
    path: '/welcome',
    Component: LandingPage,
  },
  {
    path: '/sign-in',
    Component: SignInPage,
  },
  {
    path: '/sign-up',
    Component: SignUpPage,
  },
  {
    path: '/callback',
    Component: CallbackPage,
  },
  {
    path: '/shared/:token',
    Component: SharedBRDView,
  },

  // ─── Protected routes (auth required) ──────────────────────────────────
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      {
        // AuthGuard renders <Outlet />, Layout is the nested layout
        Component: Layout,
        children: [
          { index: true, Component: DashboardLive },
          { path: 'projects', Component: ProjectsListView },
          { path: 'projects/new', Component: NewProject },
          { path: 'projects/:projectId', Component: ProjectWorkspace },
          { path: 'projects/:projectId/brd', Component: BRDViewer },
          { path: 'projects/:projectId/graph', Component: GraphExplorer },
          { path: 'projects/:projectId/analytics', Component: AnalyticsView },
          { path: 'projects/:projectId/conflicts', Component: ConflictResolutionView },
          { path: 'projects/:projectId/decisions', Component: DecisionsView },
          { path: 'projects/:projectId/sources', Component: SourcesView },
          { path: 'projects/:projectId/chain', Component: DocumentChainView },
          { path: 'projects/:projectId/integrations', Component: IntegrationsView },
          { path: 'integrations', Component: IntegrationsView },
          { path: 'settings', Component: SettingsView },
          { path: 'help', Component: HelpView },
          { path: 'search', Component: SearchView },
          { path: 'profile', Component: ProfileView },

          // ─── Admin-only routes (role-gated) ──────────────────────────
          {
            Component: AdminGuard,
            children: [
              { path: 'admin', Component: AdminPage },
              { path: 'ai-settings', Component: AISettingsView },
            ],
          },
        ],
      },
    ],
  },
]);
