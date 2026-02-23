/**
 * AdminGuard — Route guard that restricts access to admin-only pages.
 *
 * Checks the authenticated user's role via useAdmin() hook.
 * Renders children if admin, shows "Access Denied" otherwise.
 */
import { Outlet, useNavigate } from "react-router";
import { useAdmin } from "../hooks/useAdmin";
import { ShieldOff, Loader2, ArrowLeft } from "lucide-react";

export function AdminGuard() {
    const { isAdmin, isLoading } = useAdmin();
    const navigate = useNavigate();

    // Still loading role from Convex
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-60px)]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Checking permissions…</p>
                </div>
            </div>
        );
    }

    // Not admin — show access denied
    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-60px)]">
                <div className="text-center max-w-md relative">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-red-500/5 rounded-full blur-3xl" />
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/5">
                            <ShieldOff className="w-8 h-8 text-red-400" />
                        </div>
                        <h2 className="text-[20px] font-semibold mb-2">Access Denied</h2>
                        <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                            This page is restricted to administrators. Contact your workspace admin if you need access.
                        </p>
                        <button
                            onClick={() => navigate("/")}
                            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-[14px] font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Admin — render children
    return <Outlet />;
}
