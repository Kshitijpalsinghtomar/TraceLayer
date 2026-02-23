/**
 * useAdmin — Role-based admin check using Convex user data.
 *
 * Replaces the old localStorage passcode approach with a real
 * database-backed role check. The user's `role` field in the
 * Convex `users` table determines admin status.
 *
 * The first user to register is automatically promoted to admin
 * (bootstrap mechanism in convex/users.ts syncUser).
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user } = useAuth();
  const authProviderId = user?.logtoId ?? "";

  const role = useQuery(
    api.users.getRole,
    authProviderId ? { authProviderId } : "skip"
  );

  // role is undefined while loading, null if user not found, or the role string
  const isLoading = role === undefined;
  const isAdmin = role === "admin";

  return { isAdmin, isLoading, role };
}
