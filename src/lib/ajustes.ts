// Ajustes locales del POS (precio envío, textos del ticket, descuento manual, etc.)
const KEY = "pos_ajustes_v1";

export type Ajustes = {
  precioEnvio: number;
  ticketHeader: string;
  ticketFooter: string;
  descuentoManualActivo: boolean;
};

const DEFAULTS: Ajustes = {
  precioEnvio: 2.5,
  ticketHeader: "XÖLO BURRITOS NORTEÑOS",
  ticketFooter: "¡Gracias por su compra!",
  descuentoManualActivo: true,
};

export function getAjustes(): Ajustes {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setAjustes(patch: Partial<Ajustes>) {
  const next = { ...getAjustes(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("pos:ajustes"));
  return next;
}

import { useEffect, useState } from "react";
export function useAjustes() {
  const [a, setA] = useState<Ajustes>(getAjustes());
  useEffect(() => {
    const h = () => setA(getAjustes());
    window.addEventListener("pos:ajustes", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pos:ajustes", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return a;
}
