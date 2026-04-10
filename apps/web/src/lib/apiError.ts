export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const response = (
      error as {
        response?: { status?: number; data?: { error?: unknown; message?: unknown } };
        code?: string;
        message?: string;
      }
    ).response;
    const data = response?.data;

    if (typeof data?.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }

    if (typeof data?.error === "object" && data.error !== null) {
      const structured = data.error as {
        formErrors?: unknown;
        fieldErrors?: Record<string, unknown>;
      };

      if (Array.isArray(structured.formErrors)) {
        const firstFormError = structured.formErrors.find(
          (entry) => typeof entry === "string" && entry.trim().length > 0
        ) as string | undefined;

        if (firstFormError) return firstFormError;
      }

      if (structured.fieldErrors && typeof structured.fieldErrors === "object") {
        for (const value of Object.values(structured.fieldErrors)) {
          if (Array.isArray(value)) {
            const firstFieldError = value.find(
              (entry) => typeof entry === "string" && entry.trim().length > 0
            ) as string | undefined;

            if (firstFieldError) return firstFieldError;
          }
        }
      }
    }

    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }

    const status = response?.status;
    if (status === 429) return "Muitas tentativas. Aguarde alguns minutos.";
    if (typeof status === "number" && status >= 500) {
      return "Servidor indisponivel no momento. Tente novamente em instantes.";
    }

    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message ?? "";
    const normalizedMessage = message.toLowerCase();

    if (code === "ECONNABORTED" || normalizedMessage.includes("timeout")) {
      return "Tempo de resposta excedido. Tente novamente.";
    }

    if (
      code === "ERR_NETWORK" ||
      normalizedMessage.includes("network error") ||
      normalizedMessage.includes("failed to fetch")
    ) {
      return "Sem conexao com o servidor. Verifique sua internet e tente novamente.";
    }
  }

  return fallback;
}
