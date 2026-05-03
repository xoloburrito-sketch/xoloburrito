import { useMemo, useState } from "react";
import { X, Banknote, CreditCard, Bike, Check } from "lucide-react";
import { eur } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  pagado: boolean;
  metodo_pago: string | null;
  modificaciones?: { extras?: { nombre: string; precio: number }[] };
};

type Metodo = "efectivo" | "tarjeta" | "glovo" | "just_eat";

const lineaTotal = (i: Item) => {
  const ex = (i.modificaciones?.extras || []).reduce((s, e) => s + Number(e.precio), 0);
  return (Number(i.precio_unitario) + ex) * i.cantidad;
};

export function SplitPaymentDialog({
  pedidoId,
  numero,
  items: initialItems,
  onClose,
  onChanged,
}: {
  pedidoId: string;
  numero: number;
  items: Item[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [metodo, setMetodo] = useState<Metodo>("efectivo");

  const seleccionados = items.filter((i) => seleccion.has(i.id) && !i.pagado);
  const totalSel = seleccionados.reduce((s, i) => s + lineaTotal(i), 0);
  const totalPagado = items.filter((i) => i.pagado).reduce((s, i) => s + lineaTotal(i), 0);
  const totalPendiente = items.filter((i) => !i.pagado).reduce((s, i) => s + lineaTotal(i), 0);

  const toggle = (id: string) => {
    setSeleccion((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const cobrarSeleccion = async () => {
    if (seleccionados.length === 0) { toast.error("Selecciona líneas a cobrar"); return; }
    const ids = seleccionados.map((i) => i.id);
    const { error } = await supabase
      .from("items_pedido")
      .update({ pagado: true, metodo_pago: metodo })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, pagado: true, metodo_pago: metodo } : i));
    setSeleccion(new Set());
    toast.success(`Cobrado ${eur(totalSel)} con ${metodo}`);
    onChanged();
  };

  const pendientes = useMemo(() => items.filter((i) => !i.pagado), [items]);
  const todoPagado = pendientes.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-2xl font-black">Dividir cuenta · #{numero}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-6 w-6" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-muted p-2"><div className="opacity-70">Pagado</div><div className="font-black text-success">{eur(totalPagado)}</div></div>
            <div className="rounded-xl bg-muted p-2"><div className="opacity-70">Seleccionado</div><div className="font-black text-primary">{eur(totalSel)}</div></div>
            <div className="rounded-xl bg-muted p-2"><div className="opacity-70">Pendiente</div><div className="font-black">{eur(totalPendiente)}</div></div>
          </div>

          <div className="space-y-2">
            {items.map((i) => {
              const sel = seleccion.has(i.id);
              return (
                <button
                  key={i.id}
                  disabled={i.pagado}
                  onClick={() => toggle(i.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] ${
                    i.pagado ? "border-success bg-success/10 opacity-60" :
                    sel ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${i.pagado ? "bg-success text-white" : sel ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {i.pagado || sel ? <Check className="h-4 w-4" /> : null}
                    </div>
                    <div>
                      <div className="font-bold">{i.cantidad}× {i.nombre}</div>
                      {i.pagado && <div className="text-xs text-success">✓ pagado ({i.metodo_pago})</div>}
                    </div>
                  </div>
                  <div className="font-black text-primary">{eur(lineaTotal(i))}</div>
                </button>
              );
            })}
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Cobrar selección con</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                { k: "efectivo", label: "Efectivo", Icon: Banknote },
                { k: "tarjeta", label: "Tarjeta", Icon: CreditCard },
                { k: "glovo", label: "Glovo", Icon: Bike },
                { k: "just_eat", label: "Just Eat", Icon: Bike },
              ] as const).map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => setMetodo(k)}
                  className={`flex items-center justify-center gap-1 rounded-2xl py-3 text-sm font-bold active:scale-95 ${
                    metodo === k ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                ><Icon className="h-4 w-4" /> {label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button
            onClick={cobrarSeleccion}
            disabled={seleccionados.length === 0}
            className="w-full rounded-2xl bg-success py-4 text-lg font-black text-success-foreground active:scale-95 disabled:opacity-40"
          >
            ✓ Cobrar {eur(totalSel)} ({metodo})
          </button>
          {todoPagado && (
            <div className="mt-2 text-center text-sm font-bold text-success">Todas las líneas cobradas ✓</div>
          )}
        </div>
      </div>
    </div>
  );
}
