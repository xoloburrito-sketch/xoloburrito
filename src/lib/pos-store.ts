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
  tipo: TipoPedido;
  notas: string;
};

export type TipoPedido = "local" | "domicilio" | "glovo" | "just_eat";
import { getAjustes } from "./ajustes";
export const PRECIO_ENVIO_DOMICILIO = 2.5; // fallback
export const getPrecioEnvio = () => {
  try { return getAjustes().precioEnvio; } catch { return 2.5; }
};

let estado: Estado = {
  items: [],
  cliente_id: null,
  cliente_nombre: null,
  cliente_telefono: null,
  cliente_direccion: null,
  tipo: "local",
  notas: "",
};

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
    estado = {
      items: [], cliente_id: null, cliente_nombre: null, cliente_telefono: null,
      cliente_direccion: null, tipo: "local", notas: "",
    };
    emit();
  },
  setCliente: (c: { id: string; nombre: string; telefono: string; direccion: string | null } | null) => {
    if (!c) {
      estado = { ...estado, cliente_id: null, cliente_nombre: null, cliente_telefono: null, cliente_direccion: null };
    } else {
      estado = { ...estado, cliente_id: c.id, cliente_nombre: c.nombre, cliente_telefono: c.telefono, cliente_direccion: c.direccion };
    }
    emit();
  },
  setTipo: (t: TipoPedido) => { estado = { ...estado, tipo: t }; emit(); },
  setNotas: (n: string) => { estado = { ...estado, notas: n }; emit(); },
};

export const useCarrito = () => useSyncExternalStore(carrito.subscribe, carrito.get, carrito.get);

export const calcularLinea = (i: ItemCarrito) => {
  const extras = i.modificaciones.extras.reduce((s, e) => s + e.precio, 0);
  return (i.precio_unitario + extras) * i.cantidad;
};

export const calcularTotal = (items: ItemCarrito[]) =>
  items.reduce((s, i) => s + calcularLinea(i), 0);
