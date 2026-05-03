import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur, fechaCorta } from "@/lib/format";
import {
  ChevronRight, Banknote, CreditCard, Bike, Home,
  Trash2, Plus, Minus, Pencil, X, Printer, ChefHat, Copy, Ban, Split, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { ModificadorDialog } from "@/components/ModificadorDialog";
import { SplitPaymentDialog } from "@/components/SplitPaymentDialog";
import type { Modificacion, ItemCarrito } from "@/lib/pos-store";
import { ticketHTML, comandaCocinaHTML, printHTML } from "@/lib/ticket";
import { getPrecioEnvio } from "@/lib/pos-store";

export const Route = createFileRoute("/_app/pedidos")({
  component: PedidosPage,
});

type Pedido = {
  id: string;
  numero: number;
  tipo: string;
  estado: string;
  metodo_pago: string | null;
  total: number;
  subtotal: number;
  envio: number;
  descuento: number;
  recibido: number | null;
  cambio: number | null;
  notas: string | null;
  cliente_id: string | null;
  created_at: string;
  clientes: { nombre: string; telefono: string; direccion: string | null; piso: string | null; codigo_puerta: string | null; nota_reparto: string | null } | null;
};

type Item = {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  modificaciones: Modificacion;
  pagado: boolean;
  metodo_pago: string | null;
};

type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  precio: number;
  ingredientes: string[];
  activo: boolean;
};
type Categoria = { id: string; nombre: string };
type Extra = { id: string; nombre: string; precio: number };

const lineaTotal = (i: Item) => {
  const ex = (i.modificaciones?.extras || []).reduce((s, e) => s + Number(e.precio), 0);
  return (Number(i.precio_unitario) + ex) * i.cantidad;
};

function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [sel, setSel] = useState<Pedido | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [editando, setEditando] = useState<{ producto: Producto; item?: Item } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [filtro, setFiltro] = useState<"hoy" | "todos" | "anulados" | "modificados" | "glovo" | "just_eat">("hoy");
  const [busqClient, setBusqClient] = useState("");

  const SELECT_PEDIDO = "*, clientes(nombre, telefono, direccion, piso, codigo_puerta, nota_reparto)";

  const cargarPedidos = useCallback(async () => {
    const { data } = await supabase
      .from("pedidos")
      .select(SELECT_PEDIDO)
      .order("created_at", { ascending: false })
      .limit(500);
    setPedidos((data as unknown as Pedido[]) || []);
  }, []);

  const cargarItems = useCallback(async (pedidoId: string) => {
    const { data } = await supabase.from("items_pedido").select("*").eq("pedido_id", pedidoId);
    setItems((data as unknown as Item[]) || []);
  }, []);

  useEffect(() => {
    cargarPedidos();
    (async () => {
      const [{ data: cats }, { data: prods }, { data: exs }] = await Promise.all([
        supabase.from("categorias").select("*").order("orden"),
        supabase.from("productos").select("*").eq("activo", true).order("orden"),
        supabase.from("extras").select("*").eq("activo", true).order("nombre"),
      ]);
      setCategorias((cats as Categoria[]) || []);
      setProductos(((prods || []) as unknown) as Producto[]);
      setExtras((exs as Extra[]) || []);
    })();
  }, [cargarPedidos]);

  useEffect(() => {
    if (!sel) { setItems([]); return; }
    cargarItems(sel.id);
  }, [sel, cargarItems]);

  const recalcularTotal = async (pedidoId: string, nuevosItems: Item[]) => {
    const subtotal = nuevosItems.reduce((s, i) => s + lineaTotal(i), 0);
    const envio = sel?.tipo === "domicilio" ? getPrecioEnvio() : 0;
    await supabase.from("pedidos").update({ subtotal, envio, total: subtotal + envio }).eq("id", pedidoId);
    const { data } = await supabase
      .from("pedidos")
      .select("*, clientes(nombre, telefono, direccion, piso, codigo_puerta, nota_reparto)")
      .eq("id", pedidoId)
      .single();
    if (data) setSel(data as unknown as Pedido);
    cargarPedidos();
  };

  const cambiarCantidad = async (item: Item, delta: number) => {
    const nueva = item.cantidad + delta;
    if (nueva < 1) return;
    await supabase.from("items_pedido").update({ cantidad: nueva }).eq("id", item.id);
    const next = items.map((i) => i.id === item.id ? { ...i, cantidad: nueva } : i);
    setItems(next);
    if (sel) recalcularTotal(sel.id, next);
  };

  const borrarItem = async (item: Item) => {
    if (!confirm(`¿Quitar "${item.nombre}" del pedido?`)) return;
    await supabase.from("items_pedido").delete().eq("id", item.id);
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    if (sel) recalcularTotal(sel.id, next);
    toast.success("Item eliminado");
  };

  const guardarEdicion = async (cantidad: number, mods: Modificacion) => {
    if (!editando || !sel) return;
    if (editando.item) {
      await supabase.from("items_pedido").update({
        cantidad,
        modificaciones: mods as never,
      }).eq("id", editando.item.id);
      const next = items.map((i) =>
        i.id === editando.item!.id ? { ...i, cantidad, modificaciones: mods } : i,
      );
      setItems(next);
      recalcularTotal(sel.id, next);
    } else {
      const { data, error } = await supabase.from("items_pedido").insert({
        pedido_id: sel.id,
        producto_id: editando.producto.id,
        nombre: editando.producto.nombre,
        cantidad,
        precio_unitario: editando.producto.precio,
        modificaciones: mods as never,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      const next = [...items, data as unknown as Item];
      setItems(next);
      recalcularTotal(sel.id, next);
      toast.success("Producto añadido");
    }
    setEditando(null);
  };

  const borrarPedido = async () => {
    if (!sel) return;
    if (!confirm(`¿Eliminar pedido #${sel.numero}? Esta acción no se puede deshacer.`)) return;
    await supabase.from("items_pedido").delete().eq("pedido_id", sel.id);
    await supabase.from("pedidos").delete().eq("id", sel.id);
    toast.success(`Pedido #${sel.numero} eliminado`);
    setSel(null);
    cargarPedidos();
  };

  const cambiarTipo = async (tipo: "local" | "domicilio" | "glovo" | "just_eat") => {
    if (!sel) return;
    const envio = tipo === "domicilio" ? getPrecioEnvio() : 0;
    const subtotal = items.reduce((s, i) => s + lineaTotal(i), 0);
    await supabase.from("pedidos").update({ tipo, envio, total: subtotal + envio, subtotal }).eq("id", sel.id);
    cargarPedidos();
    const { data } = await supabase.from("pedidos").select("*, clientes(nombre, telefono, direccion, piso, codigo_puerta, nota_reparto)").eq("id", sel.id).single();
    if (data) setSel(data as unknown as Pedido);
  };

  const cambiarMetodo = async (metodo: "efectivo" | "tarjeta" | "glovo" | "just_eat") => {
    if (!sel) return;
    await supabase.from("pedidos").update({ metodo_pago: metodo }).eq("id", sel.id);
    setSel({ ...sel, metodo_pago: metodo });
    cargarPedidos();
  };

  const cambiarPrecio = async (item: Item, nuevo: number) => {
    if (isNaN(nuevo) || nuevo < 0) { toast.error("Precio inválido"); return; }
    await supabase.from("items_pedido").update({ precio_unitario: nuevo }).eq("id", item.id);
    const next = items.map((i) => i.id === item.id ? { ...i, precio_unitario: nuevo } : i);
    setItems(next);
    if (sel) recalcularTotal(sel.id, next);
    toast.success("Precio actualizado");
  };

  const totalHoy = pedidos
    .filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString())
    .reduce((s, p) => s + Number(p.total), 0);

  const totalActual = items.reduce((s, i) => s + lineaTotal(i), 0);

  // convierte Item -> ItemCarrito para reusar el dialog
  const itemToCarrito = (it: Item): ItemCarrito => ({
    uid: it.id,
    producto_id: it.producto_id || "",
    nombre: it.nombre,
    precio_unitario: Number(it.precio_unitario),
    cantidad: it.cantidad,
    modificaciones: it.modificaciones || { quitar: [], extras: [], notas: "" },
  });

  return (
    <div className="grid h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_440px]">
      <section className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h1 className="text-2xl font-black">Pedidos</h1>
          <div className="rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
            <div className="text-xs opacity-80">Hoy</div>
            <div className="text-xl font-black">{eur(totalHoy)}</div>
          </div>
        </div>
        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {pedidos.map((p) => (
            <button
              key={p.id}
              onClick={() => setSel(p)}
              className={`flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] ${
                sel?.id === p.id ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <div className="rounded-xl bg-primary px-3 py-2 text-center text-primary-foreground">
                <div className="text-xs opacity-80">#</div>
                <div className="text-lg font-black">{p.numero}</div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  {p.tipo === "domicilio" ? <Bike className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  <span className="font-bold">{p.clientes?.nombre || "Sin cliente"}</span>
                </div>
                <div className="text-xs text-muted-foreground">{fechaCorta(p.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-primary">{eur(Number(p.total))}</div>
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  {p.metodo_pago === "tarjeta" ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                  {p.metodo_pago}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
          {pedidos.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Sin pedidos aún</div>
          )}
        </div>
      </section>

      <aside className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {!sel ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Selecciona un pedido
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Pedido</div>
                  <div className="text-3xl font-black">#{sel.numero}</div>
                  <div className="text-sm text-muted-foreground">{fechaCorta(sel.created_at)}</div>
                </div>
                <button
                  onClick={borrarPedido}
                  className="flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive active:scale-95"
                >
                  <Trash2 className="h-4 w-4" /> Borrar
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  { k: "local", label: "Local", Icon: Home },
                  { k: "domicilio", label: "Domicilio", Icon: Bike },
                  { k: "glovo", label: "Glovo", Icon: Bike },
                  { k: "just_eat", label: "Just Eat", Icon: Bike },
                ] as const).map(({ k, label, Icon }) => (
                  <button
                    key={k}
                    onClick={() => cambiarTipo(k)}
                    className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold active:scale-95 ${
                      sel.tipo === k ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  ><Icon className="h-4 w-4" /> {label}</button>
                ))}
              </div>

              {sel.clientes && (
                <div className="mt-2 rounded-xl bg-muted p-2 text-sm">
                  <div className="font-bold">{sel.clientes.nombre}</div>
                  <div className="text-xs">📞 {sel.clientes.telefono}</div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {items.map((i) => (
                <div key={i.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-primary px-2 py-0.5 text-sm font-black text-primary-foreground">
                          {i.cantidad}×
                        </span>
                        <span className="font-bold">{i.nombre}</span>
                      </div>
                      {i.modificaciones?.quitar?.map((q) => (
                        <div key={q} className="text-xs text-destructive">− sin {q}</div>
                      ))}
                      {i.modificaciones?.extras?.map((e) => (
                        <div key={e.nombre} className="text-xs text-success">+ {e.nombre}</div>
                      ))}
                      {i.modificaciones?.notas && <div className="text-xs italic">"{i.modificaciones.notas}"</div>}
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => {
                          const v = prompt(`Precio unitario de "${i.nombre}" (€)`, String(i.precio_unitario));
                          if (v == null) return;
                          cambiarPrecio(i, parseFloat(v.replace(",", ".")));
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >{eur(Number(i.precio_unitario))} <Pencil className="inline h-3 w-3" /></button>
                      <div className="font-black text-primary">{eur(lineaTotal(i))}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <button onClick={() => cambiarCantidad(i, -1)} className="rounded-lg bg-muted p-2 active:scale-95"><Minus className="h-4 w-4" /></button>
                    <button onClick={() => cambiarCantidad(i, +1)} className="rounded-lg bg-muted p-2 active:scale-95"><Plus className="h-4 w-4" /></button>
                    <button
                      onClick={() => {
                        const p = productos.find((x) => x.id === i.producto_id);
                        if (p) setEditando({ producto: p, item: i });
                        else toast.error("Producto base no disponible para editar modificaciones");
                      }}
                      className="rounded-lg bg-muted p-2 active:scale-95"
                    ><Pencil className="h-4 w-4" /></button>
                    <div className="flex-1" />
                    <button onClick={() => borrarItem(i)} className="rounded-lg bg-destructive/10 p-2 text-destructive active:scale-95">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Sin productos en este pedido</div>
              )}

              <button
                onClick={() => setShowAdd(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary active:scale-95"
              >
                <Plus className="h-5 w-5" /> Añadir producto
              </button>
            </div>

            <div className="space-y-2 border-t border-border p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { k: "efectivo", label: "Efectivo", Icon: Banknote },
                  { k: "tarjeta", label: "Tarjeta", Icon: CreditCard },
                  { k: "glovo", label: "Glovo", Icon: Bike },
                  { k: "just_eat", label: "Just Eat", Icon: Bike },
                ] as const).map(({ k, label, Icon }) => (
                  <button
                    key={k}
                    onClick={() => cambiarMetodo(k)}
                    className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold active:scale-95 ${
                      sel.metodo_pago === k ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  ><Icon className="h-4 w-4" /> {label}</button>
                ))}
              </div>
              <div className="flex justify-between"><span>Productos</span><span>{eur(totalActual)}</span></div>
              {Number(sel.envio || 0) > 0 && (
                <div className="flex justify-between"><span>Envío</span><span>{eur(Number(sel.envio))}</span></div>
              )}
              {sel.recibido !== null && sel.metodo_pago === "efectivo" && (
                <div className="flex justify-between"><span>Recibido</span><span>{eur(Number(sel.recibido))}</span></div>
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-bold">TOTAL</span>
                <span className="text-2xl font-black text-primary">{eur(totalActual + Number(sel.envio || 0))}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {editando && (
        <ModificadorDialog
          producto={editando.producto}
          extras={extras}
          initial={editando.item ? itemToCarrito(editando.item) : undefined}
          onClose={() => setEditando(null)}
          onSave={guardarEdicion}
        />
      )}

      {showAdd && sel && (
        <AddProductoDialog
          productos={productos}
          categorias={categorias}
          onClose={() => setShowAdd(false)}
          onPick={(p) => { setShowAdd(false); setEditando({ producto: p }); }}
        />
      )}
    </div>
  );
}

function AddProductoDialog({
  productos, categorias, onClose, onPick,
}: {
  productos: Producto[];
  categorias: Categoria[];
  onClose: () => void;
  onPick: (p: Producto) => void;
}) {
  const [cat, setCat] = useState<string | null>(categorias[0]?.id ?? null);
  const filtrados = productos.filter((p) => p.categoria_id === cat);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl font-black">Añadir producto al pedido</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border p-3">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-bold active:scale-95 ${
                cat === c.id ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >{c.nombre}</button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="flex aspect-square flex-col justify-between rounded-2xl border border-border bg-card p-3 text-left active:scale-95 hover:border-primary"
            >
              <div className="text-sm font-black leading-tight">{p.nombre}</div>
              <div className="text-xl font-black text-primary">{eur(p.precio)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
