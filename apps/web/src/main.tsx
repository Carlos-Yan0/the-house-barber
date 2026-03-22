// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes — no background refetch during that window.
      staleTime: 1000 * 60 * 5,
      // Keep unused cache entries for 10 minutes before garbage-collecting them.
      // Previously gcTime defaulted to 5 min (same as staleTime), meaning cache
      // was evicted as soon as it went stale — forcing a full reload on every revisit.
      gcTime: 1000 * 60 * 10,
      // Retry once on network errors; don't spam the server on 4xx responses.
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      // Show cached data immediately while revalidating in background.
      placeholderData: (prev: unknown) => prev,
    },
    mutations: {
      // Surface mutation errors to the console during development.
      onError: process.env.NODE_ENV === "development"
        ? (err) => console.error("[mutation error]", err)
        : undefined,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1c1c1c",
              color: "#f5f5f5",
              border: "1px solid #2a2a2a",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#d4920f", secondary: "#111" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);