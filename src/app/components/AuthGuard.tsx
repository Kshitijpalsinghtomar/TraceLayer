/**
 * AuthGuard — Protects routes that require authentication.
 *
 * - Shows loading spinner while auth is being checked
 * - Syncs user to Convex after authentication
 * - Redirects to /sign-in if not authenticated
 * - Shows error state with retry on failures
 */
import { Outlet, Navigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Layers, Loader2, AlertCircle, RotateCcw, LogOut } from 'lucide-react';

export function AuthGuard() {
    const { isAuthenticated, isLoading, isSyncing, error, signIn, signOut, clearError } = useAuth();

    // ── Loading: checking auth state ──────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center mx-auto mb-4">
                        <Layers className="w-6 h-6 text-primary" />
                    </div>
                    <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Checking authentication...</p>
                </div>
            </div>
        );
    }

    // ── Error: auth check failed ──────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">Authentication Error</h2>
                    <p className="text-sm text-muted-foreground mb-6">{error.message}</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => { clearError(); signIn(); }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                        </button>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Not authenticated: redirect to sign-in ────────────────────────────
    if (!isAuthenticated) {
        return <Navigate to="/sign-in" replace />;
    }

    // ── Syncing user to Convex ────────────────────────────────────────────
    if (isSyncing) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
                </div>
            </div>
        );
    }

    // ── Authenticated and synced — render protected content ───────────────
    return <Outlet />;
}
