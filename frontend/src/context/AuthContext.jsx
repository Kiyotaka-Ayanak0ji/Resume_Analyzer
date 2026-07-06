import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("rs_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rs_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("rs_user", JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem("rs_token");
        localStorage.removeItem("rs_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const applyAuth = useCallback((data) => {
    localStorage.setItem("rs_token", data.token);
    localStorage.setItem("rs_user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    applyAuth(res.data);
    return res.data.user;
  }, [applyAuth]);

  const register = useCallback(async (name, email, password) => {
    const res = await api.post("/auth/register", { name, email, password });
    applyAuth(res.data);
    return res.data.user;
  }, [applyAuth]);

  const googleLogin = useCallback(async (credential) => {
    const res = await api.post("/auth/google", { credential });
    applyAuth(res.data);
    return res.data.user;
  }, [applyAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem("rs_token");
    localStorage.removeItem("rs_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
