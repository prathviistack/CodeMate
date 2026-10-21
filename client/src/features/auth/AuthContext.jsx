import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);

  // Restore the session from the HttpOnly cookie on page load.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => !cancelled && setUser(u))
      .catch((e) => {
        if (cancelled) return;
        if (e.response?.status !== 401) setServerError(e.friendly);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (body) => setUser(await authApi.login(body)), []);
  const signup = useCallback(async (body) => setUser(await authApi.register(body)), []);
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, serverError, login, signup, logout }),
    [user, loading, serverError, login, signup, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
