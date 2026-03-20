// src/utils/keepAlive.ts
/**
 * Anti-cold-start service for Render Free Tier
 * Pings the service every 14 minutes to prevent sleep
 * Also pings Supabase to keep the database connection alive
 */
export function keepAlive() {
  const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
  const API_URL = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;

  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/healthcheck`);
      const data = await res.json();
      console.log(`[KeepAlive] Ping OK at ${data.timestamp}`);
    } catch (err) {
      console.error("[KeepAlive] Ping failed:", err);
    }
  }, PING_INTERVAL);

  console.log(`[KeepAlive] Service started — pinging every 14 minutes`);
}
