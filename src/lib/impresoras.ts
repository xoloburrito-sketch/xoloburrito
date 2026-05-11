// Gestor de múltiples impresoras (localStorage)
import { useEffect, useState } from "react";

const KEY = "impresoras_config";

export type ImpresoraTipo = "lan" | "bluetooth" | "usb";
export type ImpresoraRol = "cliente" | "cocina" | "negocio" | "todas";
export type ImpresoraPapel = "58mm" | "80mm";

export type Impresora = {
  id: string;
  nombre: string;
  tipo: ImpresoraTipo;
  ip?: string;
  puerto?: number;
  dispositivo_bt?: string;
  papel: ImpresoraPapel;
  activa: boolean;
  rol: ImpresoraRol;
};

export const ROL_LABEL: Record<ImpresoraRol, string> = {
  cliente: "Ticket cliente",
  cocina: "Comanda cocina",
  negocio: "Ticket negocio",
  todas: "Todas las copias",
};

export const TIPO_LABEL: Record<ImpresoraTipo, string> = {
  lan: "Red/LAN",
  bluetooth: "Bluetooth",
  usb: "USB",
};

export function getImpresoras(): Impresora[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveImpresoras(list: Impresora[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  window.dispatchEvent(new Event("pos:impresoras"));
}

export function useImpresoras() {
  const [list, setList] = useState<Impresora[]>(getImpresoras());
  useEffect(() => {
    const h = () => setList(getImpresoras());
    window.addEventListener("pos:impresoras", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pos:impresoras", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return list;
}

export function nuevaImpresora(): Impresora {
  return {
    id: crypto.randomUUID(),
    nombre: "Nueva impresora",
    tipo: "lan",
    ip: "",
    puerto: 9100,
    papel: "80mm",
    activa: true,
    rol: "todas",
  };
}

export async function testImpresora(p: Impresora): Promise<boolean> {
  if (p.tipo === "lan" && p.ip) {
    try {
      await fetch(`http://${p.ip}:${p.puerto || 9100}/`, {
        mode: "no-cors",
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch {
      return false;
    }
  }
  // BT/USB no soportadas desde navegador → fallback impresión por sistema
  return false;
}

/** Devuelve true si hay alguna impresora configurada y activa. */
export function hayImpresorasActivas(): boolean {
  return getImpresoras().some((p) => p.activa);
}

/** Selecciona impresoras activas que reciben un rol concreto. */
export function impresorasParaRol(rol: "cliente" | "cocina" | "negocio"): Impresora[] {
  return getImpresoras().filter((p) => p.activa && (p.rol === rol || p.rol === "todas"));
}
