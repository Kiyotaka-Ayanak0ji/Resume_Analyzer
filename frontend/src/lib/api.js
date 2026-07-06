import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rs_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("rs_token");
      localStorage.removeItem("rs_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = "Something went wrong. Please try again.") =>
  e?.response?.data?.detail || fallback;
