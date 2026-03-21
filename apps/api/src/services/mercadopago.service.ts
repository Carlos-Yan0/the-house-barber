// src/services/mercadopago.service.ts
import { addMinutes } from "date-fns";

const MP_BASE = "https://api.mercadopago.com";

export interface PixPaymentResult {
  mpPaymentId: number;
  qrCode: string;
  qrCodeBase64: string;
  pixCopiaECola: string;
  ticketUrl: string;
  expiresAt: string;
}

export interface CreatePixParams {
  appointmentId: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
}

export async function createPixPayment(
  params: CreatePixParams
): Promise<PixPaymentResult> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");

  const expiresAt = addMinutes(new Date(), 30).toISOString();

  const body = {
    transaction_amount: Number(params.amount),
    description: params.description,
    payment_method_id: "pix",
    date_of_expiration: expiresAt,
    payer: {
      email: params.payerEmail,
      first_name: params.payerFirstName,
      last_name: params.payerLastName || ".",
    },
  };

  const res = await fetch(`${MP_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Chave idempotente evita pagamento duplicado se a requisição for repetida
      "X-Idempotency-Key": params.appointmentId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const txData = data?.point_of_interaction?.transaction_data;

  if (!txData?.qr_code) {
    throw new Error("Resposta do Mercado Pago sem dados PIX");
  }

  return {
    mpPaymentId:   data.id,
    qrCode:        txData.qr_code,
    qrCodeBase64:  txData.qr_code_base64 ?? "",
    pixCopiaECola: txData.qr_code,
    ticketUrl:     txData.ticket_url ?? "",
    expiresAt,
  };
}

export async function getPaymentStatus(mpPaymentId: number): Promise<string> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");

  const res = await fetch(`${MP_BASE}/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`MP status check failed: ${res.status}`);
  const data = await res.json();
  return data.status; // "pending" | "approved" | "rejected" | "cancelled"
}