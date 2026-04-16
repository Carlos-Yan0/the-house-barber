import { useEffect } from "react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

let authBootstrapToken: string | null = null;
let authBootstrapPromise: Promise<unknown> | null = null;

export function useAuthInit() {
  const { isAuthenticated, token, user, hasFreshProfile, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      authBootstrapToken = null;
      authBootstrapPromise = null;
      return;
    }

    if (user && hasFreshProfile) {
      authBootstrapToken = token;
      return;
    }

    // Avoid duplicate /auth/me calls caused by StrictMode remounts or repeated bootstraps.
    if (user && authBootstrapToken === token) return;

    if (!authBootstrapPromise || authBootstrapToken !== token) {
      authBootstrapToken = token;
      authBootstrapPromise = authApi
        .me()
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          authBootstrapToken = null;
          logout();
        })
        .finally(() => {
          authBootstrapPromise = null;
        });
    }

    void authBootstrapPromise;
  }, [isAuthenticated, token, user, hasFreshProfile, setUser, logout]);
}
