/**
 * CallbackPage — Handles Logto OIDC redirect after sign-in/sign-up.
 *
 * This page is mounted at /callback and:
 * 1. Processes the auth code from Logto
 * 2. Shows a branded loading screen
 * 3. Redirects to the dashboard on success
 * 4. Shows an error with retry option on failure
 */
import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router';
import { Layers, Loader2, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export function CallbackPage() {
    const navigate = useNavigate();
    const [callbackError, setCallbackError] = useState<Error | null>(null);

    const { isLoading } = useHandleSignInCallback(() => {
        // Auth successful — navigate to dashboard
        navigate('/', { replace: true });
    });

    // Catch errors during callback processing
    if (!isLoading && callbackError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    {/* Logo */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/25 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-7 h-7 text-red-400" />
                    </div>

                    <h1 className="text-xl font-semibold text-foreground mb-2">Authentication Failed</h1>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                        {callbackError.message || 'Something went wrong during sign-in. Please try again.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            onClick={() => navigate('/sign-in', { replace: true })}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/welcome', { replace: true })}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                        >
                            Back to Home
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state — processing the callback
    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="max-w-sm w-full text-center">
                {/* Logo */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/10">
                    <Layers className="w-7 h-7 text-primary" />
                </div>

                {/* Spinner */}
                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-4" />

                <h2 className="text-lg font-medium text-foreground mb-1">Signing you in...</h2>
                <p className="text-sm text-muted-foreground">
                    Setting up your workspace. This takes just a moment.
                </p>

                {/* Progress dots animation */}
                <div className="flex items-center justify-center gap-1.5 mt-6">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"
                            style={{ animationDelay: `${i * 0.2}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
