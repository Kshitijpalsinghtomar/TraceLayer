/**
 * useAdmin — Simple admin role management hook.
 * Admin mode is unlocked with a passcode and persisted in localStorage.
 * In production, replace with proper auth (Clerk, Auth0, etc.)
 */
import { useState, useCallback, useEffect } from 'react';

const ADMIN_STORAGE_KEY = 'tracelayer_admin';
const ADMIN_PASSCODE = 'tracelayer2026'; // In production, use proper auth

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, isAdmin ? 'true' : 'false');
    } catch {
      // localStorage unavailable
    }
  }, [isAdmin]);

  const login = useCallback((passcode: string): boolean => {
    if (passcode === ADMIN_PASSCODE) {
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAdmin(false);
  }, []);

  return { isAdmin, login, logout };
}

/** Context-free check — useful in components that just need to read */
export function isAdminMode(): boolean {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
