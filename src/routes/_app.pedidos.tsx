import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur, fechaCorta } from "@/lib/format";
import { ChevronRight, Banknote, CreditCard, Bike, Home } from "lucide-react";

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
  recibido: number | null;
  cambio: number | null;
  notas: string | null;
  cliente_id: string | null;
  created_at: string;
  clientes: { nombre: string; telefono: string } | null;
};

type Item = {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  modificaciones: { quitar: string[]; extras: { nombre: string; precio: number }[]; notas: string };
};

function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [sel, setSel] = useState<Pedido | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*, clientes(nombre, telefono)")
        .order("created_at", { ascending: false })
        .limit(200);
      setPedidos((data as unknown as Pedido[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (!sel) { setItems([]); return; }
    (async () => {
      const { data } = await supabase.from("items_pedido").select("*").eq("pedido_id", sel.id);
      setItems((data as unknown as Item[]) || []);
    })();
  }, [sel]);

  const totalHoy = pedidos
    .filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString())
    .reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="grid h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_400px]">
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
              <div className="text-xs uppercase text-muted-foreground">Pedido</div>
              <div className="text-3xl font-black">#{sel.numero}</div>
              <div className="text-sm text-muted-foreground">{fechaCorta(sel.created_at)}</div>
              {sel.clientes && (
                <div className="mt-2 rounded-xl bg-muted p-2 text-sm">
                  <div className="font-bold">{sel.clientes.nombre}</div>
                  <div className="text-xs">📞 {sel.clientes.telefono}</div>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {items.map((i) => (
                <div key={i.id} className="rounded-xl border border-border p-2 text-sm">
                  <div className="flex justify-between">
                    <span><b>{i.cantidad}×</b> {i.nombre}</span>
                    <span className="font-bold">{eur(i.precio_unitario * i.cantidad)}</span>
                  </div>
                  {i.modificaciones?.quitar?.map((q) => (
                    <div key={q} className="text-xs text-destructive">− sin {q}</div>
                  ))}
                  {i.modificaciones?.extras?.map((e) => (
                    <div key={e.nombre} className="text-xs text-success">+ {e.nombre}</div>
                  ))}
                  {i.modificaciones?.notas && <div className="text-xs italic">"{i.modificaciones.notas}"</div>}
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-border p-4 text-sm">
              <div className="flex justify-between"><span>Método</span><span className="font-bold">{sel.metodo_pago}</span></div>
              {sel.recibido !== null && (
                <div className="flex justify-between"><span>Recibido</span><span>{eur(Number(sel.recibido))}</span></div>
              )}
              {sel.cambio !== null && Number(sel.cambio) > 0 && (
                <div className="flex justify-between"><span>Cambio</span><span>{eur(Number(sel.cambio))}</span></div>
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-bold">TOTAL</span>
                <span className="text-2xl font-black text-primary">{eur(Number(sel.total))}</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
