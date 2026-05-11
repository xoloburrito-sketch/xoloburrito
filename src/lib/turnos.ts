// Sistema de turnos (TARDE / NOCHE) — persistido en localStorage
import { useEffect, useState } from "react";

const KEY_ACTIVO = "pos_turno_activo";
const KEY_HIST = "pos_turnos_historial";

export type TurnoNombre = "tarde" | "noche";

export type TurnoActivo = {
  turno: TurnoNombre;
  inicio: string; // ISO
};

export type ResumenTurno = {
  pedidos: number;
  total: number;
  efectivo: number;
  tarjeta: number;
  glovo: number;
  just_eat: number;
  uber_eats: number;
  envios: number;
};

export type CierreTurno = TurnoActivo & {
  fin: string;
  resumen: ResumenTurno;
};

export function getTurnoActivo(): TurnoActivo | null {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(KEY_ACTIVO);
    return r ? (JSON.parse(r) as TurnoActivo) : null;
  } catch {
    return null;
  }
}

export function iniciarTurno(t: TurnoNombre): TurnoActivo {
  const activo: TurnoActivo = { turno: t, inicio: new Date().toISOString() };
  localStorage.setItem(KEY_ACTIVO, JSON.stringify(activo));
  window.dispatchEvent(new Event("pos:turno"));
  return activo;
}

export function cerrarTurnoActivo(resumen: ResumenTurno): CierreTurno | null {
  const a = getTurnoActivo();
  if (!a) return null;
  const cierre: CierreTurno = { ...a, fin: new Date().toISOString(), resumen };
  const hist = getHistorialTurnos();
  hist.unshift(cierre);
  localStorage.setItem(KEY_HIST, JSON.stringify(hist.slice(0, 365)));
  localStorage.removeItem(KEY_ACTIVO);
  window.dispatchEvent(new Event("pos:turno"));
  return cierre;
}

export function getHistorialTurnos(): CierreTurno[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_HIST) || "[]") as CierreTurno[];
  } catch {
    return [];
  }
}

export function useTurnoActivo() {
  const [t, setT] = useState<TurnoActivo | null>(getTurnoActivo());
  useEffect(() => {
    const h = () => setT(getTurnoActivo());
    window.addEventListener("pos:turno", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pos:turno", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return t;
}

export function duracionMinutos(inicio: string, fin: string) {
  return Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000);
}

export const turnoLabel = (t: TurnoNombre) => (t === "tarde" ? "TARDE" : "NOCHE");
