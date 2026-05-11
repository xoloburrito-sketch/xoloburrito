// Ajustes locales del POS (todos en localStorage, aplicados en caliente)
import { useEffect, useState } from "react";

const KEY = "pos_ajustes_v1";

export type Tema = "dark" | "light" | "rojo";
export type Papel = "58mm" | "80mm";

export type Ajustes = {
  // Negocio
  nombreNegocio: string;
  direccionNegocio: string;
  telefonoNegocio: string;
  cifNegocio: string;
  logoBase64: string; // data:image/...
  // Facturación
  iva: number; // %
  moneda: string; // símbolo, p.ej. €
  precioEnvio: number;
  descuentoGlobal: number; // %
  // Turnos
  turno1Nombre: string;
  turno1Hora: string; // HH:MM
  turno2Nombre: string;
  turno2Hora: string;
  // Impresora
  printerIP: string;
  printerPort: number;
  papel: Papel;
  // Apariencia
  tema: Tema;
  // Sonidos
  sonidoAdd: boolean;
  sonidoCobro: boolean;
  // Ticket
  ticketHeader: string;
  ticketFooter: string;
  mostrarIVA: boolean;
  mostrarLogo: boolean;
  // Compat
  descuentoManualActivo: boolean;
};

const DEFAULTS: Ajustes = {
  nombreNegocio: "XÖLO BURRITOS NORTEÑOS",
  direccionNegocio: "",
  telefonoNegocio: "",
  cifNegocio: "",
  logoBase64: "",
  iva: 10,
  moneda: "€",
  precioEnvio: 2.5,
  descuentoGlobal: 0,
  turno1Nombre: "Tarde",
  turno1Hora: "13:00",
  turno2Nombre: "Noche",
  turno2Hora: "20:00",
  printerIP: "",
  printerPort: 9100,
  papel: "80mm",
  tema: "dark",
  sonidoAdd: true,
  sonidoCobro: true,
  ticketHeader: "XÖLO BURRITOS NORTEÑOS",
  ticketFooter: "¡Gracias por su compra!",
  mostrarIVA: false,
  mostrarLogo: true,
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
  if (patch.tema) aplicarTema(patch.tema);
  return next;
}

export function resetAjustes() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("pos:ajustes"));
  aplicarTema(DEFAULTS.tema);
}

export const DEFAULT_AJUSTES = DEFAULTS;

export function aplicarTema(t: Tema) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.classList.remove("theme-light", "theme-rojo", "dark");
  if (t === "light") r.classList.add("theme-light");
  else if (t === "rojo") r.classList.add("theme-rojo");
  // dark = default (no class needed for current setup)
}

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
