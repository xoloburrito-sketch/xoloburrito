import { useEffect, useMemo, useRef, useState } from "react";
import { Modificacion } from "@/lib/pos-store";
import { eur } from "@/lib/format";
import { X, Printer, Calculator, Banknote, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = {
  uid: string;
  producto_id: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  modificaciones: Modificacion;
};

type Estado = {
  items: Item[];
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  tipo: "local" | "domicilio";
  notas: string;
};

const lineaTotal = (i: Item) => {
  const ex = i.modificaciones.extras.reduce((s, e) => s + e.precio, 0);
  return (i.precio_unitario + ex) * i.cantidad;
};

export function PagoDialog({
  estado,
  total,
  onClose,
  onPagado,
}: {
  estado: Estado;
  total: number;
  onClose: () => void;
  onPagado: () => void;
}) {
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta">("efectivo");
  const [recibido, setRecibido] = useState<string>("");
  const [confirmando, setConfirmando] = useState(false);
  const [pedidoOk, setPedidoOk] = useState<{ numero: number; fecha: string } | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const cambio = useMemo(() => {
    const r = parseFloat(recibido.replace(",", "."));
    if (!isFinite(r)) return 0;
    return Math.max(0, r - total);
  }, [recibido, total]);

  const sugerencias = useMemo(() => {
    const base = Math.ceil(total);
    return Array.from(new Set([base, base + 5, base + 10, 20, 50])).filter((v) => v >= total).slice(0, 5);
  }, [total]);

  const tap = (d: string) => setRecibido((r) => (r + d).replace(/^0+(\d)/, "$1"));
  const back = () => setRecibido((r) => r.slice(0, -1));
  const punto = () => setRecibido((r) => (r.includes(".") ? r : (r || "0") + "."));

  const confirmar = async () => {
    if (metodo === "efectivo" && (!recibido || parseFloat(recibido.replace(",", ".")) < total)) {
      toast.error("Importe recibido insuficiente");
      return;
    }
    setConfirmando(true);
    try {
      const recibidoNum = metodo === "efectivo" ? parseFloat(recibido.replace(",", ".")) : total;
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: estado.cliente_id,
          tipo: estado.tipo,
          estado: "pagado",
          metodo_pago: metodo,
          subtotal: total,
          total: total,
          recibido: recibidoNum,
          cambio: metodo === "efectivo" ? cambio : 0,
          notas: estado.notas || null,
        })
        .select()
        .single();
      if (error) throw error;

      const items = estado.items.map((i) => ({
        pedido_id: pedido.id,
        producto_id: i.producto_id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        modificaciones: i.modificaciones as never,
      }));
      const { error: e2 } = await supabase.from("items_pedido").insert(items);
      if (e2) throw e2;

      setPedidoOk({ numero: pedido.numero, fecha: pedido.created_at });
      toast.success(`Pedido #${pedido.numero} cobrado`);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setConfirmando(false);
    }
  };

  const imprimir = () => window.print();

  const descargar = () => {
    if (!ticketRef.current) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;width:80mm;color:#000}</style>
</head><body>${ticketRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${pedidoOk?.numero ?? "pedido"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pantalla post-pago: ticket
  if (pedidoOk) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
        <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-2xl">
          <div className="no-print flex items-center justify-between border-b border-border p-4">
            <h2 className="text-xl font-black text-success">✓ Cobrado #{pedidoOk.numero}</h2>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted p-4">
            <div ref={ticketRef} className="ticket-print mx-auto rounded-xl">
              <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 14 }}>🌯 BURRITOS</div>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                Pedido #{pedidoOk.numero}<br />
                {new Date(pedidoOk.fecha).toLocaleString("es-ES")}
              </div>
              <div>------------------------------</div>
              <div>{estado.tipo === "domicilio" ? "🛵 DOMICILIO" : "🏪 LOCAL"}</div>
              {estado.cliente_nombre && (
                <div>
                  Cliente: {estado.cliente_nombre}<br />
                  Tel: {estado.cliente_telefono}
                  {estado.cliente_direccion && (<><br />Dir: {estado.cliente_direccion}</>)}
                </div>
              )}
              <div>------------------------------</div>
              {estado.items.map((i) => (
                <div key={i.uid} style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{i.cantidad}x {i.nombre}</span>
                    <span>{eur(lineaTotal(i))}</span>
                  </div>
                  {i.modificaciones.quitar.map((q) => (
                    <div key={q} style={{ paddingLeft: 10, fontSize: 10 }}>- sin {q}</div>
                  ))}
                  {i.modificaciones.extras.map((e) => (
                    <div key={e.nombre} style={{ paddingLeft: 10, fontSize: 10 }}>+ {e.nombre} {e.precio > 0 ? eur(e.precio) : ""}</div>
                  ))}
                  {i.modificaciones.notas && <div style={{ paddingLeft: 10, fontSize: 10, fontStyle: "italic" }}>* {i.modificaciones.notas}</div>}
                </div>
              ))}
              <div>------------------------------</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 14 }}>
                <span>TOTAL</span><span>{eur(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Pago ({metodo})</span>
                <span>{metodo === "efectivo" ? eur(parseFloat(recibido.replace(",", "."))) : eur(total)}</span>
              </div>
              {metodo === "efectivo" && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Cambio</span><span>{eur(cambio)}</span>
                </div>
              )}
              <div style={{ textAlign: "center", marginTop: 10 }}>¡Gracias!</div>
            </div>
          </div>
          <div className="no-print grid grid-cols-3 gap-2 border-t border-border p-3">
            <button onClick={imprimir} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3 text-secondary-foreground active:scale-95">
              <Printer className="h-5 w-5" /><span className="text-xs font-bold">Imprimir</span>
            </button>
            <button onClick={descargar} className="flex flex-col items-center gap-1 rounded-2xl bg-muted py-3 text-foreground active:scale-95">
              <span className="text-lg">⬇</span><span className="text-xs font-bold">Descargar</span>
            </button>
            <button onClick={onPagado} className="rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground active:scale-95">
              Nuevo pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-2xl font-black flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /> Cobrar</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-3xl bg-secondary p-6 text-center text-secondary-foreground">
            <div className="text-sm opacity-70">Total a cobrar</div>
            <div className="text-5xl font-black tracking-tight text-primary">{eur(total)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMetodo("efectivo")}
              className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition active:scale-95 ${
                metodo === "efectivo" ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted"
              }`}
            >
              <Banknote className="h-6 w-6" /> Efectivo
            </button>
            <button
              onClick={() => setMetodo("tarjeta")}
              className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition active:scale-95 ${
                metodo === "tarjeta" ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted"
              }`}
            >
              <CreditCard className="h-6 w-6" /> Tarjeta
            </button>
          </div>

          {metodo === "efectivo" ? (
            <>
              <div className="rounded-2xl bg-muted p-4">
                <div className="text-xs font-bold uppercase text-muted-foreground">Recibido</div>
                <div className="text-3xl font-black">{eur(parseFloat(recibido.replace(",", ".")) || 0)}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="text-2xl font-black text-success">{eur(cambio)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {sugerencias.map((v) => (
                  <button
                    key={v}
                    onClick={() => setRecibido(String(v))}
                    className="rounded-full bg-accent px-4 py-2 font-bold text-accent-foreground active:scale-95"
                  >
                    {eur(v)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1","2","3","4","5","6","7","8","9"].map((d) => (
                  <button key={d} onClick={() => tap(d)} className="rounded-2xl bg-muted py-4 text-2xl font-bold active:scale-95 active:bg-primary active:text-primary-foreground">
                    {d}
                  </button>
                ))}
                <button onClick={punto} className="rounded-2xl bg-muted py-4 text-2xl font-bold active:scale-95">.</button>
                <button onClick={() => tap("0")} className="rounded-2xl bg-muted py-4 text-2xl font-bold active:scale-95">0</button>
                <button onClick={back} className="rounded-2xl bg-muted py-4 text-2xl font-bold active:scale-95 active:bg-destructive active:text-destructive-foreground">⌫</button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-accent p-6 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-primary" />
              <p className="mt-3 font-bold">Cobra con el datáfono</p>
              <p className="text-sm text-muted-foreground">Cuando termine, pulsa Confirmar</p>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <button
            onClick={confirmar}
            disabled={confirmando}
            className="w-full rounded-2xl bg-success py-5 text-xl font-black text-success-foreground shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            {confirmando ? "Procesando…" : `✓ Confirmar pago · ${eur(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
