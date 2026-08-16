"use client";

import { useEffect } from "react";
import axios from "axios";

// Configure default axios behavior immediately on module evaluation
axios.defaults.withCredentials = true;

// Attach persistent session id header from localStorage if present
axios.interceptors.request.use((config) => {
  config.withCredentials = true;
  if (typeof window !== "undefined") {
    const sessionId = localStorage.getItem("github_assistant_session_id");
    if (sessionId && config.headers) {
      config.headers["x-session-id"] = sessionId;
    }
  }
  return config;
});

// Capture session id from response headers
axios.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      const sessionId =
        response.headers["x-session-id"] || response.headers["X-Session-Id"];
      if (sessionId) {
        localStorage.setItem("github_assistant_session_id", String(sessionId));
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default function AxiosConfig() {
  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  return null;
}
