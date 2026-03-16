"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import type { AdminUser } from "./auth";
import { verifyAdmin } from "./auth";

const AuthContext = createContext<{
  admin: AdminUser | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const user = await verifyAdmin(username, password);
    if (user) {
      setAdmin(user);
      return null;
    }
    return "账号或密码错误，或账户已被禁用";
  }, []);

  const logout = useCallback(() => setAdmin(null), []);

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
