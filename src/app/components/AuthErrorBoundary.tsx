/**
 * AuthErrorBoundary — Catches auth-related React errors.
 *
 * Prevents white screen of death when auth fails unexpectedly.
 * Shows a branded error page with retry and sign-out options.
 */
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, LogOut } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[AuthErrorBoundary] Caught error:', error, info);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleSignOut = () => {
        // Clear all auth state and redirect to landing
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (_) {
            // Ignore storage errors
        }
        window.location.href = '/welcome';
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const errMsg = this.state.error?.message || 'An unexpected error occurred.';
        const isAuthError = errMsg.toLowerCase().includes('token')
            || errMsg.toLowerCase().includes('auth')
            || errMsg.toLowerCase().includes('sign')
            || errMsg.toLowerCase().includes('session');

        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-7 h-7 text-amber-400" />
                    </div>

                    <h1 className="text-xl font-semibold text-foreground mb-2">
                        {isAuthError ? 'Authentication Error' : 'Something Went Wrong'}
                    </h1>

                    <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                        {isAuthError
                            ? 'Your session may have expired. Please sign in again.'
                            : 'An unexpected error occurred. Please try again.'}
                    </p>

                    {/* Error detail (collapsed for non-dev users) */}
                    <details className="mb-6 text-left">
                        <summary className="text-xs text-muted-foreground/50 cursor-pointer hover:text-muted-foreground/70 transition-colors">
                            Technical details
                        </summary>
                        <pre className="mt-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground font-mono overflow-auto max-h-32">
                            {errMsg}
                        </pre>
                    </details>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            onClick={this.handleRetry}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                        </button>
                        <button
                            onClick={this.handleSignOut}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
