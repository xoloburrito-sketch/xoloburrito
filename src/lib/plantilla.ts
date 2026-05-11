// Plantilla configurable de tickets (localStorage)
import { useEffect, useState } from "react";

const KEY = "ticket_plantilla";

export type TipoSeparador = "guiones" | "iguales" | "puntos" | "ninguno";
export type FormatoCantidad = "antes" | "despues"; // 2x Burrito | Burrito x2
export type TamCocina = "normal" | "grande" | "muy-grande";

export type Plantilla = {
  // cabecera
  mostrarLogo: boolean;
  nombreNegocio: string;
  direccion: string;
  telefono: string;
  cif: string;
  textoCabecera: string;
  separador: TipoSeparador;
  // cuerpo
  mostrarNumPedido: boolean;
  mostrarFechaHora: boolean;
  mostrarTurno: boolean;
  mostrarPrecioUnit: boolean;
  formatoCantidad: FormatoCantidad;
  mostrarIVA: boolean;
  // pie
  pie1: string;
  pie2: string;
  mostrarQR: boolean;
  qrUrl: string;
  qrTexto: string;
  // cocina
  cocinaCabecera: string;
  cocinaTamFuente: TamCocina;
  cocinaMostrarNumPedido: boolean;
  cocinaMostrarTipo: boolean;
  cocinaSeparador: TipoSeparador;
};

export const PLANTILLA_DEFAULT: Plantilla = {
  mostrarLogo: true,
  nombreNegocio: "XÖLO BURRITOS NORTEÑOS",
  direccion: "",
  telefono: "",
  cif: "",
  textoCabecera: "",
  separador: "iguales",
  mostrarNumPedido: true,
  mostrarFechaHora: true,
  mostrarTurno: false,
  mostrarPrecioUnit: false,
  formatoCantidad: "antes",
  mostrarIVA: false,
  pie1: "¡Gracias por su compra!",
  pie2: "",
  mostrarQR: false,
  qrUrl: "",
  qrTexto: "",
  cocinaCabecera: "XÖLO BURRITOS",
  cocinaTamFuente: "grande",
  cocinaMostrarNumPedido: true,
  cocinaMostrarTipo: true,
  cocinaSeparador: "iguales",
};

export function getPlantilla(): Plantilla {
  if (typeof window === "undefined") return PLANTILLA_DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return PLANTILLA_DEFAULT;
    return { ...PLANTILLA_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return PLANTILLA_DEFAULT;
  }
}

export function savePlantilla(p: Partial<Plantilla>) {
  const next = { ...getPlantilla(), ...p };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("pos:plantilla"));
  return next;
}

export function resetPlantilla() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("pos:plantilla"));
}

export function usePlantilla() {
  const [p, setP] = useState<Plantilla>(getPlantilla());
  useEffect(() => {
    const h = () => setP(getPlantilla());
    window.addEventListener("pos:plantilla", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pos:plantilla", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return p;
}

export function separadorChars(s: TipoSeparador): string {
  if (s === "guiones") return "----------------------------------------";
  if (s === "iguales") return "========================================";
  if (s === "puntos") return "········································";
  return "";
}

export function tamCocinaPx(t: TamCocina): number {
  if (t === "muy-grande") return 22;
  if (t === "grande") return 18;
  return 14;
}
