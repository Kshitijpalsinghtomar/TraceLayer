/**
 * SignUpPage — Branded redirect launcher for Logto sign-up.
 *
 * Auto-redirects to Logto's hosted registration page on mount.
 * Shows branded loading UI while redirecting.
 * Displays error messages if auth fails.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Layers, Loader2, ArrowRight, AlertCircle, RotateCcw } from 'lucide-react';

export function SignUpPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, error, signUp, clearError } = useAuth();

    // If already authenticated, go to dashboard
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    // Auto-redirect to Logto sign-up on mount
    useEffect(() => {
        if (!isAuthenticated && !isLoading && !error) {
            signUp();
        }
    }, [isAuthenticated, isLoading, error, signUp]);

    // ── Error state ─────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="max-w-md w-full">
                    <div className="text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/10">
                            <Layers className="w-7 h-7 text-primary" />
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>

                        <h1 className="text-xl font-semibold text-foreground mb-2">Sign-Up Failed</h1>
                        <p className="text-sm text-muted-foreground mb-6">{error.message}</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { clearError(); signUp(); }}
                                className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium text-sm hover:from-indigo-400 hover:to-violet-400 transition-all shadow-md shadow-indigo-500/20"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={() => navigate('/welcome')}
                                className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                            >
                                <ArrowRight className="w-4 h-4" />
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Loading/redirecting state ────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="max-w-sm w-full text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/10">
                    <Layers className="w-7 h-7 text-primary" />
                </div>

                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-4" />

                <h2 className="text-lg font-medium text-foreground mb-1">Creating your account...</h2>
                <p className="text-sm text-muted-foreground">
                    You'll be taken to our secure registration page.
                </p>

                <button
                    onClick={signUp}
                    className="mt-8 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-4"
                >
                    Click here if you're not redirected
                </button>
            </div>
        </div>
    );
}
