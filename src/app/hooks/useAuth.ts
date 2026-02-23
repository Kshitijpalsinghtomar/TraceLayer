/**
 * useAuth — Central auth hook for the entire application.
 *
 * Wraps Logto's `useLogto()` and provides:
 * - Auth state (isAuthenticated, isLoading, error)
 * - User profile (name, email, avatar, logtoId)
 * - Sign in / sign up / sign out actions
 * - Convex user sync
 *
 * Every component that needs auth should use this hook — never import
 * `@logto/react` directly in components.
 */
import { useLogto, type IdTokenClaims } from '@logto/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AuthUser {
    logtoId: string;
    email: string;
    name: string;
    avatar?: string;
}

export interface AuthState {
    /** Logto reports authenticated */
    isAuthenticated: boolean;
    /** Initial auth check in progress */
    isLoading: boolean;
    /** Auth-related error (token expired, network, etc.) */
    error: Error | null;
    /** Parsed user from ID token */
    user: AuthUser | null;
    /** Convex user record (synced from Logto) */
    convexUser: any | null;
    /** Whether we're syncing user to Convex */
    isSyncing: boolean;
    /** Redirect to Logto sign-in page */
    signIn: () => void;
    /** Redirect to Logto sign-up page */
    signUp: () => void;
    /** Sign out and redirect to landing */
    signOut: () => void;
    /** Clear current error */
    clearError: () => void;
}

// ─── Redirect URIs ──────────────────────────────────────────────────────────
const getCallbackUri = () => `${window.location.origin}/callback`;
const getPostLogoutUri = () => `${window.location.origin}/welcome`;

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useAuth(): AuthState {
    const {
        isAuthenticated,
        isLoading: logtoLoading,
        signIn: logtoSignIn,
        signOut: logtoSignOut,
        getIdTokenClaims,
        error: logtoError,
    } = useLogto();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncedRef = useRef(false);

    // Convex user sync
    const syncUser = useMutation(api.users.syncUser);
    const convexUser = useQuery(
        api.users.getByAuthProviderId,
        user?.logtoId ? { authProviderId: user.logtoId } : 'skip'
    );

    // ── Extract user from ID token claims ───────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || logtoLoading) return;

        let cancelled = false;

        (async () => {
            try {
                const claims: IdTokenClaims | undefined = await getIdTokenClaims();
                if (cancelled || !claims) return;

                const authUser: AuthUser = {
                    logtoId: claims.sub,
                    email: (claims as any).email ?? '',
                    name: (claims as any).name ?? (claims as any).username ?? 'User',
                    avatar: (claims as any).picture ?? undefined,
                };

                setUser(authUser);
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    console.error('[useAuth] Failed to get ID token claims:', err);
                    setError(err instanceof Error ? err : new Error('Failed to get user info'));
                }
            }
        })();

        return () => { cancelled = true; };
    }, [isAuthenticated, logtoLoading, getIdTokenClaims]);

    // ── Sync to Convex when user is available ───────────────────────────────
    useEffect(() => {
        if (!user || syncedRef.current) return;

        let cancelled = false;

        (async () => {
            setIsSyncing(true);
            try {
                await syncUser({
                    authProviderId: user.logtoId,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatar,
                });
                if (!cancelled) {
                    syncedRef.current = true;
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[useAuth] Failed to sync user to Convex:', err);
                    // Don't block the user for sync failures — they can still use the app
                }
            } finally {
                if (!cancelled) setIsSyncing(false);
            }
        })();

        return () => { cancelled = true; };
    }, [user, syncUser]);

    // ── Propagate Logto errors ──────────────────────────────────────────────
    useEffect(() => {
        if (logtoError) {
            setError(logtoError instanceof Error ? logtoError : new Error(String(logtoError)));
        }
    }, [logtoError]);

    // ── Actions ─────────────────────────────────────────────────────────────
    const signIn = useCallback(() => {
        try {
            logtoSignIn(getCallbackUri());
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Sign-in failed'));
        }
    }, [logtoSignIn]);

    const signUp = useCallback(() => {
        try {
            // Logto supports 'signUp' interaction mode via the signIn method
            logtoSignIn(getCallbackUri());
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Sign-up failed'));
        }
    }, [logtoSignIn]);

    const signOut = useCallback(() => {
        try {
            syncedRef.current = false;
            setUser(null);
            logtoSignOut(getPostLogoutUri());
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Sign-out failed'));
        }
    }, [logtoSignOut]);

    const clearError = useCallback(() => setError(null), []);

    return {
        isAuthenticated,
        isLoading: logtoLoading,
        error,
        user,
        convexUser: convexUser ?? null,
        isSyncing,
        signIn,
        signUp,
        signOut,
        clearError,
    };
}
