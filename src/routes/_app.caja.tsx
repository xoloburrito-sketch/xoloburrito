import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { carrito, useCarrito, calcularTotal, calcularLinea, ItemCarrito, getPrecioEnvio, TipoPedido } from "@/lib/pos-store";
import { eur } from "@/lib/format";
import { ModificadorDialog } from "@/components/ModificadorDialog";
import { ClienteDialog } from "@/components/ClienteDialog";
import { PagoDialog } from "@/components/PagoDialog";
import { Trash2, User, Home, Bike, Plus, Minus, Pencil, Bike as BikeIcon } from "lucide-react";
import { beepAdd } from "@/lib/sonidos";

export const Route = createFileRoute("/_app/caja")({
  component: CajaPage,
});

type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  precio: number;
  ingredientes: string[];
  activo: boolean;
};
type Categoria = { id: string; nombre: string; orden: number };
type Extra = { id: string; nombre: string; precio: number };

function CajaPage() {
  const estado = useCarrito();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ producto: Producto; item?: ItemCarrito } | null>(null);
  const [showCliente, setShowCliente] = useState(false);
  const [showPago, setShowPago] = useState(false);
  const [tabMovil, setTabMovil] = useState<"menu" | "pedido">("menu");

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: prods }, { data: exs }] = await Promise.all([
        supabase.from("categorias").select("*").order("orden"),
        supabase.from("productos").select("*").eq("activo", true).order("orden"),
        supabase.from("extras").select("*").eq("activo", true).order("nombre"),
      ]);
      const c = (cats as Categoria[]) || [];
      setCategorias(c);
      setProductos(((prods || []) as unknown) as Producto[]);
      setExtras((exs as Extra[]) || []);
      if (c.length) setCatActiva(c[0].id);
    })();
  }, []);

  const totalProductos = calcularTotal(estado.items);
  const envioDefault = estado.tipo === "domicilio" ? getPrecioEnvio() : 0;
  const envio = estado.envio_override !== null && estado.envio_override !== undefined ? estado.envio_override : envioDefault;
  const total = totalProductos + envio;
  const productosFiltrados = productos.filter((p) => p.categoria_id === catActiva);

  const TIPOS: { k: TipoPedido; label: string; Icon: typeof Home }[] = [
    { k: "local", label: "Local", Icon: Home },
    { k: "domicilio", label: "Domicilio", Icon: Bike },
    { k: "glovo", label: "Glovo", Icon: Bike },
    { k: "just_eat", label: "Just Eat", Icon: Bike },
    { k: "uber_eats", label: "🛵 Uber Eats", Icon: Bike },
  ];

  const onClickProducto = (p: Producto) => setEditando({ producto: p });
  const onEditarItem = (item: ItemCarrito) => {
    const p = productos.find((x) => x.id === item.producto_id);
    if (p) setEditando({ producto: p, item });
  };

  return (
    <div className="grid h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_400px]">
      {/* Izquierda: menú */}
      <section className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-border p-3">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatActiva(c.id)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-base font-bold transition active:scale-95 ${
                catActiva === c.id ? "bg-primary text-primary-foreground shadow" : "bg-muted text-foreground"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => onClickProducto(p)}
              className="group flex aspect-square flex-col justify-between rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition active:scale-95 hover:border-primary hover:shadow-lg"
            >
              <div className="text-base font-black leading-tight">{p.nombre}</div>
              <div className="text-2xl font-black text-primary">{eur(p.precio)}</div>
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground">
              Sin productos en esta categoría
            </div>
          )}
        </div>
      </section>

      {/* Derecha: carrito */}
      <aside className="flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-sm">
        <div className="space-y-2 border-b border-border p-3">
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(({ k, label, Icon }) => (
              <button
                key={k}
                onClick={() => carrito.setTipo(k)}
                className={`flex items-center justify-center gap-1 rounded-2xl py-3 text-xs font-bold active:scale-95 ${
                  estado.tipo === k ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCliente(true)}
            className="flex w-full items-center gap-2 rounded-2xl bg-secondary p-3 text-left text-secondary-foreground active:scale-95"
          >
            <User className="h-5 w-5 text-primary" />
            <div className="flex-1 overflow-hidden">
              {estado.cliente_nombre ? (
                <>
                  <div className="truncate font-bold">{estado.cliente_nombre}</div>
                  <div className="truncate text-xs opacity-70">📞 {estado.cliente_telefono}</div>
                </>
              ) : (
                <div className="text-sm font-bold">+ Añadir cliente</div>
              )}
            </div>
            {estado.cliente_id && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); carrito.setCliente(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); carrito.setCliente(null); } }}
                className="rounded-full p-1 hover:bg-sidebar-accent"
              >
                <Trash2 className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {estado.items.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div>
                <div className="text-5xl">🌯</div>
                <p className="mt-3 font-semibold">Toca un producto<br />para empezar</p>
              </div>
            </div>
          )}
          {estado.items.map((i) => (
            <div key={i.uid} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-primary px-2 py-0.5 text-sm font-black text-primary-foreground">
                      {i.cantidad}×
                    </span>
                    <span className="font-bold">{i.nombre}</span>
                  </div>
                  {(i.modificaciones.quitar.length > 0 || i.modificaciones.extras.length > 0 || i.modificaciones.notas) && (
                    <div className="mt-1 space-y-0.5 text-xs">
                      {i.modificaciones.quitar.map((q) => (
                        <div key={q} className="text-destructive">− sin {q}</div>
                      ))}
                      {i.modificaciones.extras.map((e) => (
                        <div key={e.nombre} className="text-success">+ {e.nombre} {e.precio > 0 && `(${eur(e.precio)})`}</div>
                      ))}
                      {i.modificaciones.notas && <div className="italic text-muted-foreground">"{i.modificaciones.notas}"</div>}
                    </div>
                  )}
                </div>
                <div className="text-right font-black text-primary">{eur(calcularLinea(i))}</div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <button onClick={() => carrito.update(i.uid, { cantidad: Math.max(1, i.cantidad - 1) })}
                  className="rounded-lg bg-muted p-2 active:scale-95"><Minus className="h-4 w-4" /></button>
                <button onClick={() => carrito.update(i.uid, { cantidad: i.cantidad + 1 })}
                  className="rounded-lg bg-muted p-2 active:scale-95"><Plus className="h-4 w-4" /></button>
                <button onClick={() => onEditarItem(i)} className="rounded-lg bg-muted p-2 active:scale-95"><Pencil className="h-4 w-4" /></button>
                <div className="flex-1" />
                <button onClick={() => carrito.remove(i.uid)} className="rounded-lg bg-destructive/10 p-2 text-destructive active:scale-95">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border p-3">
          {(estado.tipo === "domicilio" || envio > 0) && (
            <div className="space-y-1 rounded-xl bg-muted p-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">{eur(totalProductos)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1 font-bold"><BikeIcon className="h-3 w-3" /> Envío</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="0.50" min="0"
                    value={envio}
                    onChange={(e) => carrito.setEnvioOverride(parseFloat(e.target.value) || 0)}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-right text-sm font-bold"
                  />
                  <span>€</span>
                  {envio > 0 && (
                    <button onClick={() => carrito.setEnvioOverride(0)} className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">quitar</button>
                  )}
                  {estado.envio_override !== null && (
                    <button onClick={() => carrito.setEnvioOverride(null)} className="rounded bg-secondary/20 px-2 py-1 text-xs">auto</button>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold uppercase text-muted-foreground">Total</span>
            <span className="text-3xl font-black text-primary">{eur(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => carrito.clear()}
              disabled={estado.items.length === 0}
              className="rounded-2xl bg-muted py-3 text-sm font-bold active:scale-95 disabled:opacity-40"
            >
              Vaciar
            </button>
            <button
              onClick={() => setShowPago(true)}
              disabled={estado.items.length === 0}
              className="rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground shadow active:scale-95 disabled:opacity-40"
            >
              Cobrar
            </button>
          </div>
        </div>
      </aside>

      {editando && (
        <ModificadorDialog
          producto={editando.producto}
          extras={extras}
          initial={editando.item}
          onClose={() => setEditando(null)}
          onSave={(cantidad, mods) => {
            if (editando.item) {
              carrito.update(editando.item.uid, { cantidad, modificaciones: mods });
            } else {
              carrito.add({
                producto_id: editando.producto.id,
                nombre: editando.producto.nombre,
                precio_unitario: editando.producto.precio,
                cantidad,
                modificaciones: mods,
              });
              beepAdd();
            }
            setEditando(null);
          }}
        />
      )}

      {showCliente && <ClienteDialog onClose={() => setShowCliente(false)} />}

      {showPago && (
        <PagoDialog
          estado={estado}
          total={totalProductos}
          onClose={() => setShowPago(false)}
          onPagado={() => { carrito.clear(); setShowPago(false); }}
        />
      )}
    </div>
  );
}
