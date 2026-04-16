import { appointmentsApi } from "@/lib/api";
import type { AvailabilityResponse } from "@/types";

export type AvailabilitySocketQuery = {
  barberId: string;
  date: string;
  serviceId: string;
};

type AvailabilitySocketMessage =
  | (AvailabilityResponse & { type: "availability" })
  | { type: "error"; error: string; status?: number };

type AvailabilitySocketHandlers = {
  onAvailability: (payload: AvailabilityResponse) => void;
  onSocketUnavailable: () => void;
  onErrorMessage?: (message: string) => void;
};

const SOCKET_CONNECT_TIMEOUT_MS = 2000;

function getAvailabilitySocketUrl(query: AvailabilitySocketQuery): string {
  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
  const wsBaseUrl = baseUrl.startsWith("https://")
    ? `wss://${baseUrl.slice("https://".length)}`
    : baseUrl.startsWith("http://")
    ? `ws://${baseUrl.slice("http://".length)}`
    : baseUrl;

  const url = new URL(`${wsBaseUrl}/appointments/availability/ws`);
  url.searchParams.set("barberId", query.barberId);
  url.searchParams.set("date", query.date);
  url.searchParams.set("serviceId", query.serviceId);
  return url.toString();
}

export async function fetchAvailabilityHttp(
  query: AvailabilitySocketQuery
): Promise<AvailabilityResponse> {
  const response = await appointmentsApi.getAvailability(
    query.barberId,
    query.date,
    query.serviceId
  );
  return response.data as AvailabilityResponse;
}

export function connectAvailabilitySocket(
  query: AvailabilitySocketQuery,
  handlers: AvailabilitySocketHandlers
): () => void {
  let didFallback = false;
  let closedByClient = false;
  let hasReceivedPayload = false;
  let didOpen = false;
  let socket: WebSocket | null = null;

  const connectTimer = window.setTimeout(() => {
    if (!hasReceivedPayload && !didOpen) fallback();
  }, SOCKET_CONNECT_TIMEOUT_MS);

  const clearConnectTimer = () => {
    window.clearTimeout(connectTimer);
  };

  const fallback = () => {
    if (didFallback) return;
    didFallback = true;
    clearConnectTimer();

    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      closedByClient = true;
      socket.close();
    }

    handlers.onSocketUnavailable();
  };

  socket = new WebSocket(getAvailabilitySocketUrl(query));

  socket.onopen = () => {
    didOpen = true;
    clearConnectTimer();
  };

  socket.onmessage = (event) => {
    if (didFallback || closedByClient) return;

    let payload: AvailabilitySocketMessage | null = null;
    if (typeof event.data !== "string") return;

    try {
      payload = JSON.parse(event.data) as AvailabilitySocketMessage;
    } catch {
      return;
    }

    if (!payload || typeof payload !== "object" || !("type" in payload)) return;

    if (payload.type === "availability") {
      hasReceivedPayload = true;
      clearConnectTimer();
      handlers.onAvailability({
        slots: payload.slots,
        date: payload.date,
        barberId: payload.barberId,
        serviceId: payload.serviceId,
      });
      return;
    }

    if (payload.type === "error" && typeof payload.error === "string") {
      handlers.onErrorMessage?.(payload.error);
    }
  };

  socket.onerror = () => {
    if (closedByClient) return;
    fallback();
  };

  socket.onclose = () => {
    if (closedByClient) return;
    fallback();
  };

  return () => {
    closedByClient = true;
    clearConnectTimer();
    socket.close();
  };
}
