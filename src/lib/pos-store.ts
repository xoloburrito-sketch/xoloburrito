// Carrito en memoria + utilidades del POS
import { useSyncExternalStore } from "react";

export type Modificacion = {
  quitar: string[];
  extras: { nombre: string; precio: number }[];
  notas: string;
};

export type ItemCarrito = {
  uid: string; // id local
  producto_id: string;
  nombre: string;
  precio_unitario: number; // base
  cantidad: number;
  modificaciones: Modificacion;
};

type Estado = {
  items: ItemCarrito[];
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  cliente_piso: string | null;
  cliente_codigo: string | null;
  cliente_nota: string | null;
  tipo: TipoPedido;
  notas: string;
  envio_override: number | null; // null = usar precio por defecto; 0 = sin envío; N = manual
};

export type TipoPedido = "local" | "domicilio" | "glovo" | "just_eat";
import { getAjustes } from "./ajustes";
export const PRECIO_ENVIO_DOMICILIO = 2.5; // fallback
export const getPrecioEnvio = () => {
  try { return getAjustes().precioEnvio; } catch { return 2.5; }
};

const initial = (): Estado => ({
  items: [],
  cliente_id: null,
  cliente_nombre: null,
  cliente_telefono: null,
  cliente_direccion: null,
  cliente_piso: null,
  cliente_codigo: null,
  cliente_nota: null,
  tipo: "local",
  notas: "",
  envio_override: null,
});

let estado: Estado = initial();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const carrito = {
  get: () => estado,
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  add: (item: Omit<ItemCarrito, "uid">) => {
    estado = { ...estado, items: [...estado.items, { ...item, uid: crypto.randomUUID() }] };
    emit();
  },
  update: (uid: string, patch: Partial<ItemCarrito>) => {
    estado = {
      ...estado,
      items: estado.items.map((i) => (i.uid === uid ? { ...i, ...patch } : i)),
    };
    emit();
  },
  remove: (uid: string) => {
    estado = { ...estado, items: estado.items.filter((i) => i.uid !== uid) };
    emit();
  },
  clear: () => {
    estado = initial();
    emit();
  },
  setCliente: (c: { id: string; nombre: string; telefono: string; direccion: string | null; piso?: string | null; codigo_puerta?: string | null; nota_reparto?: string | null } | null) => {
    if (!c) {
      estado = { ...estado, cliente_id: null, cliente_nombre: null, cliente_telefono: null, cliente_direccion: null, cliente_piso: null, cliente_codigo: null, cliente_nota: null };
    } else {
      estado = { ...estado, cliente_id: c.id, cliente_nombre: c.nombre, cliente_telefono: c.telefono, cliente_direccion: c.direccion, cliente_piso: c.piso ?? null, cliente_codigo: c.codigo_puerta ?? null, cliente_nota: c.nota_reparto ?? null };
    }
    emit();
  },
  setTipo: (t: TipoPedido) => { estado = { ...estado, tipo: t }; emit(); },
  setNotas: (n: string) => { estado = { ...estado, notas: n }; emit(); },
  setEnvioOverride: (v: number | null) => { estado = { ...estado, envio_override: v }; emit(); },
};

export const useCarrito = () => useSyncExternalStore(carrito.subscribe, carrito.get, carrito.get);

export const calcularLinea = (i: ItemCarrito) => {
  const extras = i.modificaciones.extras.reduce((s, e) => s + e.precio, 0);
  return (i.precio_unitario + extras) * i.cantidad;
};

export const calcularTotal = (items: ItemCarrito[]) =>
  items.reduce((s, i) => s + calcularLinea(i), 0);
