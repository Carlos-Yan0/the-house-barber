// src/lib/inputHandlers.ts
// Helpers para bloquear caracteres inválidos em campos numéricos.
// Usar junto com type="text" + inputMode para evitar o comportamento
// padrão do type="number" que aceita +, -, e, E (notação científica).

const ALLOWED_KEYS = ["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete", "Home", "End"];

/** Apenas dígitos inteiros (0-9) */
export const onlyDigits = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (!/^\d$/.test(e.key) && !ALLOWED_KEYS.includes(e.key)) {
    e.preventDefault();
  }
};

/** Dígitos + ponto decimal (para preços) */
export const onlyDecimal = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (!/^[\d.]$/.test(e.key) && !ALLOWED_KEYS.includes(e.key)) {
    e.preventDefault();
  }
};