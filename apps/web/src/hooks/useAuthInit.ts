// src/hooks/useAuthInit.ts
import { useEffect } from "react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function useAuthInit() {
  const { isAuthenticated, token, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => logout());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}