import { useMemo, useRef, useState } from "react";
import { Modificacion, getPrecioEnvio, TipoPedido } from "@/lib/pos-store";
import { eur } from "@/lib/format";
import { X, Printer, Calculator, Banknote, CreditCard, Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ticketHTML, comandaCocinaHTML, printHTML, printTicket3Copias, TICKET_CSS } from "@/lib/ticket";
import { chimeCobro } from "@/lib/sonidos";

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
  cliente_piso?: string | null;
  cliente_codigo?: string | null;
  cliente_nota?: string | null;
  tipo: TipoPedido;
  notas: string;
  envio_override?: number | null;
};

type Metodo = "efectivo" | "tarjeta" | "glovo" | "just_eat" | "uber_eats";

const lineaTotal = (i: Item) => {
  const ex = i.modificaciones.extras.reduce((s, e) => s + e.precio, 0);
  return (i.precio_unitario + ex) * i.cantidad;
};

const tipoLabel = (t: TipoPedido) =>
  t === "local" ? "LOCAL" : t === "domicilio" ? "DOMICILIO" : t === "glovo" ? "GLOVO" : t === "just_eat" ? "JUST EAT" : "UBER EATS";

export function PagoDialog({
  estado,
  total: totalProductos,
  onClose,
  onPagado,
}: {
  estado: Estado;
  total: number; // total de productos (sin envío)
  onClose: () => void;
  onPagado: () => void;
}) {
  const envioDefault = estado.tipo === "domicilio" ? getPrecioEnvio() : 0;
  const envio = estado.envio_override !== undefined && estado.envio_override !== null ? estado.envio_override : envioDefault;
  const total = totalProductos + envio;

  // Si es plataforma, método por defecto coincide
  const metodoInicial: Metodo =
    estado.tipo === "glovo" ? "glovo"
    : estado.tipo === "just_eat" ? "just_eat"
    : estado.tipo === "uber_eats" ? "uber_eats"
    : "efectivo";

  const [metodo, setMetodo] = useState<Metodo>(metodoInicial);
  const [recibido, setRecibido] = useState<string>("");
  const [confirmando, setConfirmando] = useState(false);
  const [pedidoOk, setPedidoOk] = useState<{ numero: number; fecha: string } | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const recibidoNum = parseFloat(recibido.replace(",", ".")) || 0;
  const cambio = useMemo(() => Math.max(0, recibidoNum - total), [recibidoNum, total]);

  const tap = (d: string) => setRecibido((r) => (r + d).replace(/^0+(\d)/, "$1"));
  const back = () => setRecibido((r) => r.slice(0, -1));
  const punto = () => setRecibido((r) => (r.includes(".") ? r : (r || "0") + "."));
  const limpiar = () => setRecibido("");

  const confirmar = async () => {
    if (metodo === "efectivo" && recibidoNum < total) {
      toast.error("Importe recibido insuficiente");
      return;
    }
    setConfirmando(true);
    try {
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: estado.cliente_id,
          tipo: estado.tipo,
          estado: "pagado",
          metodo_pago: metodo,
          subtotal: totalProductos,
          envio,
          total,
          recibido: metodo === "efectivo" ? recibidoNum : total,
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
      toast.error((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  };

  const imprimir = () => {
    if (!pedidoOk) return;
    const inner = ticketRef.current?.innerHTML || "";
    const cli = estado.cliente_nombre ? {
      nombre: estado.cliente_nombre,
      telefono: estado.cliente_telefono || "",
      direccion: estado.cliente_direccion,
      piso: estado.cliente_piso,
      codigo_puerta: estado.cliente_codigo,
      nota_reparto: estado.cliente_nota,
    } : null;
    const itemsT = estado.items.map((i) => ({
      nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio_unitario,
      modificaciones: i.modificaciones,
    }));
    const comanda = comandaCocinaHTML({ numero: pedidoOk.numero, tipo: estado.tipo, created_at: pedidoOk.fecha }, itemsT);
    const ok = printTicket3Copias({ ticketInner: inner, comandaInner: comanda, title: `Ticket #${pedidoOk.numero}` });
    if (!ok) toast.error("⚠️ Sin impresora detectada. Revisa los ajustes.");
    else toast.success("✅ 3 copias enviadas");
  };

  const descargar = () => {
    if (!ticketRef.current) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket #${pedidoOk?.numero ?? ""}</title>
<style>
@page { size: 80mm auto; margin: 0; }
html,body{margin:0;padding:0;background:#fff;color:#000}
body{font-family:'Consolas','Lucida Console','Courier New',monospace;font-size:13px;font-weight:600;line-height:1.35;width:72mm;padding:3mm 4mm;letter-spacing:.01em}
.ticket-title{font-size:18px;font-weight:900;text-align:center;letter-spacing:.05em;margin-bottom:4px}
.ticket-sub{text-align:center;font-size:12px;margin-bottom:6px}
.ticket-sep{border-top:1px dashed #000;margin:6px 0}
.ticket-row{display:flex;justify-content:space-between;gap:8px}
.ticket-total{font-size:16px;font-weight:900}
.ticket-mod{padding-left:10px;font-size:11px}
.ticket-foot{text-align:center;margin-top:10px;font-size:12px}
</style></head><body>${ticketRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${pedidoOk?.numero ?? "pedido"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Ticket post-pago =====
  if (pedidoOk) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
        <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-2xl">
          <div className="no-print flex items-center justify-between border-b border-border p-4">
            <h2 className="text-xl font-black text-success">✓ Cobrado #{pedidoOk.numero}</h2>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted p-4">
            <div ref={ticketRef} className="ticket-print mx-auto rounded-xl">
              <div className="ticket-title">XOLO BURRITO</div>
              <div className="ticket-sub">
                Pedido #{pedidoOk.numero}<br />
                {new Date(pedidoOk.fecha).toLocaleString("es-ES")}
              </div>
              <div className="ticket-sep" />
              <div style={{ fontWeight: 800 }}>** {tipoLabel(estado.tipo)} **</div>
              {estado.cliente_nombre && (
                <div style={{ marginTop: 4 }}>
                  Cliente: {estado.cliente_nombre}<br />
                  Tel: {estado.cliente_telefono}
                  {estado.cliente_direccion && (<><br />Dir: {estado.cliente_direccion}</>)}
                  {estado.cliente_piso && (<><br />Piso: {estado.cliente_piso}</>)}
                  {estado.cliente_codigo && (<><br />Cod: {estado.cliente_codigo}</>)}
                  {estado.cliente_nota && (<><br />Nota: {estado.cliente_nota}</>)}
                </div>
              )}
              <div className="ticket-sep" />
              {estado.items.map((i) => (
                <div key={i.uid} style={{ marginBottom: 6 }}>
                  <div className="ticket-row">
                    <span>{i.cantidad}x {i.nombre}</span>
                    <span>{eur(lineaTotal(i))}</span>
                  </div>
                  {i.modificaciones.quitar.map((q) => (
                    <div key={q} className="ticket-mod">- sin {q}</div>
                  ))}
                  {i.modificaciones.extras.map((e) => (
                    <div key={e.nombre} className="ticket-mod">+ {e.nombre} {e.precio > 0 ? eur(e.precio) : ""}</div>
                  ))}
                  {i.modificaciones.notas && <div className="ticket-mod" style={{ fontStyle: "italic" }}>* {i.modificaciones.notas}</div>}
                </div>
              ))}
              <div className="ticket-sep" />
              <div className="ticket-row"><span>Subtotal</span><span>{eur(totalProductos)}</span></div>
              {envio > 0 && (
                <div className="ticket-row"><span>Envío</span><span>{eur(envio)}</span></div>
              )}
              <div className="ticket-row ticket-total">
                <span>TOTAL</span><span>{eur(total)}</span>
              </div>
              <div className="ticket-row">
                <span>Pago ({metodo})</span>
                <span>{eur(metodo === "efectivo" ? recibidoNum : total)}</span>
              </div>
              {metodo === "efectivo" && (
                <div className="ticket-row">
                  <span>Cambio</span><span>{eur(cambio)}</span>
                </div>
              )}
              <div className="ticket-foot">¡Gracias por su compra!</div>
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

  // ===== Pantalla de cobro =====
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
            <div className="mt-1 text-xs opacity-80">
              Productos {eur(totalProductos)}
              {envio > 0 && <> · <Bike className="inline h-3 w-3" /> Envío {eur(envio)}</>}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Método de pago</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([
                { k: "efectivo", label: "Efectivo", Icon: Banknote },
                { k: "tarjeta", label: "Tarjeta", Icon: CreditCard },
                { k: "glovo", label: "Glovo", Icon: Bike },
                { k: "just_eat", label: "Just Eat", Icon: Bike },
                { k: "uber_eats", label: "🛵 Uber Eats", Icon: Bike },
              ] as const).map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => setMetodo(k)}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-95 ${
                    metodo === k ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {metodo === "efectivo" ? (
            <>
              <div className="rounded-2xl bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Recibido</div>
                  <button onClick={limpiar} className="text-xs font-bold text-muted-foreground underline">Limpiar</button>
                </div>
                <div className="text-3xl font-black">{eur(recibidoNum)}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="text-2xl font-black text-success">{eur(cambio)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1","2","3","4","5","6","7","8","9"].map((d) => (
                  <button key={d} onClick={() => tap(d)} className="rounded-2xl bg-muted py-5 text-3xl font-bold active:scale-95 active:bg-primary active:text-primary-foreground">
                    {d}
                  </button>
                ))}
                <button onClick={punto} className="rounded-2xl bg-muted py-5 text-3xl font-bold active:scale-95">.</button>
                <button onClick={() => tap("0")} className="rounded-2xl bg-muted py-5 text-3xl font-bold active:scale-95">0</button>
                <button onClick={back} className="rounded-2xl bg-muted py-5 text-3xl font-bold active:scale-95 active:bg-destructive active:text-destructive-foreground">⌫</button>
              </div>
            </>
          ) : metodo === "tarjeta" ? (
            <div className="rounded-2xl bg-accent p-6 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-primary" />
              <p className="mt-3 font-bold">Cobra con el datáfono</p>
              <p className="text-sm text-muted-foreground">Cuando termine, pulsa Confirmar</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-accent p-6 text-center">
              <Bike className="mx-auto h-12 w-12 text-primary" />
              <p className="mt-3 font-bold">Pedido pagado por {metodo === "glovo" ? "Glovo" : metodo === "just_eat" ? "Just Eat" : "Uber Eats"}</p>
              <p className="text-sm text-muted-foreground">Se registra como ingreso por plataforma</p>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <button
            onClick={confirmar}
            disabled={confirmando}
            className="w-full rounded-2xl bg-success py-5 text-xl font-black text-success-foreground shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            {confirmando ? "Procesando…" : `✓ Confirmar · ${eur(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
