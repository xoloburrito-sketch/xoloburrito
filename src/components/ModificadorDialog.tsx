import { useState } from "react";
import { Modificacion, calcularLinea, ItemCarrito } from "@/lib/pos-store";
import { eur } from "@/lib/format";
import { X, Plus, Minus } from "lucide-react";

type Producto = {
  id: string;
  nombre: string;
  precio: number;
  ingredientes: string[];
};
type Extra = { id: string; nombre: string; precio: number };

export function ModificadorDialog({
  producto,
  extras,
  initial,
  onClose,
  onSave,
}: {
  producto: Producto;
  extras: Extra[];
  initial?: ItemCarrito;
  onClose: () => void;
  onSave: (cantidad: number, mods: Modificacion) => void;
}) {
  const [cantidad, setCantidad] = useState(initial?.cantidad ?? 1);
  const [quitar, setQuitar] = useState<string[]>(initial?.modificaciones.quitar ?? []);
  const [seleccionados, setSeleccionados] = useState<{ nombre: string; precio: number }[]>(
    initial?.modificaciones.extras ?? []
  );
  const [notas, setNotas] = useState(initial?.modificaciones.notas ?? "");

  const toggleQuitar = (ing: string) =>
    setQuitar((q) => (q.includes(ing) ? q.filter((x) => x !== ing) : [...q, ing]));

  const toggleExtra = (e: Extra) =>
    setSeleccionados((s) =>
      s.find((x) => x.nombre === e.nombre)
        ? s.filter((x) => x.nombre !== e.nombre)
        : [...s, { nombre: e.nombre, precio: e.precio }]
    );

  const linea = calcularLinea({
    uid: "",
    producto_id: producto.id,
    nombre: producto.nombre,
    precio_unitario: producto.precio,
    cantidad,
    modificaciones: { quitar, extras: seleccionados, notas },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2 className="text-2xl font-black">{producto.nombre}</h2>
            <p className="text-sm text-muted-foreground">{eur(producto.precio)} base</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {producto.ingredientes.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Ingredientes — toca para quitar
              </h3>
              <div className="flex flex-wrap gap-2">
                {producto.ingredientes.map((ing) => {
                  const off = quitar.includes(ing);
                  return (
                    <button
                      key={ing}
                      onClick={() => toggleQuitar(ing)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                        off
                          ? "bg-destructive text-destructive-foreground line-through"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {off ? "❌ " : "✓ "}
                      {ing}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {extras.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Extras / Opciones
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extras.map((e) => {
                  const on = !!seleccionados.find((x) => x.nombre === e.nombre);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleExtra(e)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition active:scale-95 ${
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <span>{e.nombre}</span>
                      <span className="text-xs opacity-80">
                        {e.precio > 0 ? `+${eur(e.precio)}` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Notas</h3>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: sin cilantro, poco picante…"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              rows={2}
            />
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-2xl bg-muted p-1">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="rounded-xl bg-card p-3 active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-10 text-center text-2xl font-black">{cantidad}</span>
            <button
              onClick={() => setCantidad((c) => c + 1)}
              className="rounded-xl bg-card p-3 active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => onSave(cantidad, { quitar, extras: seleccionados, notas })}
            className="flex-1 rounded-2xl bg-primary px-4 py-4 text-lg font-black text-primary-foreground shadow-lg transition active:scale-95"
          >
            {initial ? "Guardar" : "Añadir"} · {eur(linea)}
          </button>
        </div>
      </div>
    </div>
  );
}
