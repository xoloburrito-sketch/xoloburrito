// Fuente única de verdad — wrapper sobre las claves existentes (no migra datos).
// Reexporta utilidades de turnos/ajustes/plantilla/impresoras ya existentes.

import {
  getAjustes as _getAjustes,
  setAjustes as _setAjustes,
  type Ajustes as _Ajustes,
} from "./ajustes";
import {
  getTurnoActivo as _getTurnoActivo,
  getHistorialTurnos as _getHistorialTurnos,
  type TurnoActivo,
  type CierreTurno,
} from "./turnos";

const KEYS = {
  pedidos: "xolo_pedidos",
  horarios: "xolo_horarios",
} as const;

function lsGet<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === "") return def;
    const parsed = JSON.parse(v);
    return (parsed ?? def) as T;
  } catch {
    try { localStorage.removeItem(key); } catch { /* noop */ }
    return def;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// --- Tipos ---
export interface ItemPedido {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  nota?: string;
}

export interface Pedido {
  id: string;
  fecha: string;
  turno: "tarde" | "noche" | null;
  tipo: string;
  items: ItemPedido[];
  total: number;
  metodoPago: "efectivo" | "tarjeta" | "split" | string;
  estado: "activo" | "cobrado" | "anulado";
  cliente?: string;
  nota?: string;
}

export interface HorarioDia {
  abierto: boolean;
  tarde: { apertura: string; cierre: string };
  noche: { apertura: string; cierre: string };
}
export type HorarioSemanal = Record<number, HorarioDia>;

const HORARIO_DEFAULT: HorarioSemanal = {
  0: { abierto: false, tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  1: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  2: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  3: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  4: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  5: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
  6: { abierto: true,  tarde: { apertura: "13:00", cierre: "17:00" }, noche: { apertura: "20:00", cierre: "00:00" } },
};

export const store = {
  // Pedidos (sólo si en algún punto los persistes en xolo_pedidos)
  getPedidos: (): Pedido[] => {
    const raw = lsGet<unknown>(KEYS.pedidos, []);
    return Array.isArray(raw) ? (raw as Pedido[]) : [];
  },
  setPedidos: (p: Pedido[]) => lsSet(KEYS.pedidos, Array.isArray(p) ? p : []),
  addPedido: (p: Pedido) => store.setPedidos([...store.getPedidos(), p]),
  updatePedido: (id: string, cambios: Partial<Pedido>) => {
    store.setPedidos(store.getPedidos().map((x) => (x.id === id ? { ...x, ...cambios } : x)));
  },
  getPedidosHoy: (): Pedido[] => {
    const hoy = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    return store.getPedidos().filter((p) => typeof p.fecha === "string" && p.fecha.slice(0, 10) === hoy);
  },
  getPedidosHoyTurno: (): Pedido[] => {
    const turno = _getTurnoActivo();
    if (!turno) return [];
    const inicio = new Date(turno.inicio).getTime();
    return store.getPedidos().filter((p) => {
      const t = new Date(p.fecha).getTime();
      return Number.isFinite(t) && t >= inicio && p.estado !== "anulado";
    });
  },

  // Turnos (delegado al módulo existente)
  getTurnoActivo: (): TurnoActivo | null => _getTurnoActivo(),
  getHistorialTurnos: (): CierreTurno[] => _getHistorialTurnos(),

  // Ajustes (delegado)
  getAjustes: (): _Ajustes => _getAjustes(),
  setAjustes: (a: Partial<_Ajustes>) => _setAjustes(a),

  // Horarios
  getHorarios: (): HorarioSemanal => {
    const raw = lsGet<HorarioSemanal>(KEYS.horarios, HORARIO_DEFAULT);
    return { ...HORARIO_DEFAULT, ...(raw || {}) };
  },
  setHorarios: (h: HorarioSemanal) => lsSet(KEYS.horarios, h),

  // Resumen genérico
  calcularResumen: (pedidos: Pedido[]) => {
    const lista = Array.isArray(pedidos) ? pedidos : [];
    const cobrados = lista.filter((p) => p.estado === "cobrado");
    const anulados = lista.filter((p) => p.estado === "anulado");
    const sum = (arr: Pedido[]) => arr.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return {
      total: sum(cobrados),
      efectivo: sum(cobrados.filter((p) => p.metodoPago === "efectivo")),
      tarjeta: sum(cobrados.filter((p) => p.metodoPago === "tarjeta")),
      ubereats: sum(cobrados.filter((p) => p.tipo === "ubereats" || p.tipo === "uber_eats")),
      glovo: sum(cobrados.filter((p) => p.tipo === "glovo")),
      justeat: sum(cobrados.filter((p) => p.tipo === "justeat" || p.tipo === "just_eat")),
      nPedidos: cobrados.length,
      nAnulados: anulados.length,
      totalAnulados: sum(anulados),
      ticketMedio: cobrados.length > 0 ? sum(cobrados) / cobrados.length : 0,
    };
  },
};

export type { TurnoActivo, CierreTurno };
