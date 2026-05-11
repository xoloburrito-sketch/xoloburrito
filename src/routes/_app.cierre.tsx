import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import {
  Banknote, CreditCard, Bike, Home, Calculator, Printer, RefreshCw,
  Trash2, Pencil, Check, X, Plus, Minus, Play, Square,
} from "lucide-react";
import {
  iniciarTurno, cerrarTurnoActivo, useTurnoActivo, turnoLabel,
  duracionMinutos, getHistorialTurnos, type TurnoNombre, type ResumenTurno,
} from "@/lib/turnos";

export const Route = createFileRoute("/_app/cierre")({
  component: CierrePage,
});

type Pedido = {
  id: string;
  numero: number;
  tipo: string;
  metodo_pago: string | null;
  total: number;
  subtotal: number;
  envio: number;
  created_at: string;
};

type Item = {
  id: string;
  pedido_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  modificaciones: { quitar?: string[]; extras?: { nombre: string; precio: number }[]; notas?: string };
};

const hoyISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const lineaTotal = (i: Item) => {
  const ex = (i.modificaciones?.extras || []).reduce((s, e) => s + Number(e.precio), 0);
  return (Number(i.precio_unitario) + ex) * i.cantidad;
};

function CierrePage() {
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editTotal, setEditTotal] = useState<{ id: string; valor: string } | null>(null);
  const [editPrecio, setEditPrecio] = useState<{ id: string; valor: string } | null>(null);

  const cargar = useCallback(async (f: string) => {
    setLoading(true);
    const desde = new Date(f + "T00:00:00").toISOString();
    const hasta = new Date(f + "T23:59:59.999").toISOString();
    const { data } = await supabase
      .from("pedidos")
      .select("id,numero,tipo,metodo_pago,total,subtotal,envio,created_at")
      .gte("created_at", desde)
      .lte("created_at", hasta)
      .order("numero", { ascending: true });
    setPedidos((data as unknown as Pedido[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);

  const cargarItems = async (pedidoId: string) => {
    const { data } = await supabase.from("items_pedido").select("*").eq("pedido_id", pedidoId);
    setItems((data as unknown as Item[]) || []);
  };

  const toggleExpand = async (id: string) => {
    if (expandido === id) { setExpandido(null); setItems([]); return; }
    setExpandido(id);
    await cargarItems(id);
  };

  const recalcularPedido = async (pedidoId: string, nuevosItems: Item[], envio: number) => {
    const subtotal = nuevosItems.reduce((s, i) => s + lineaTotal(i), 0);
    const total = subtotal + Number(envio || 0);
    await supabase.from("pedidos").update({ subtotal, total }).eq("id", pedidoId);
    cargar(fecha);
  };

  const cambiarCantidad = async (item: Item, delta: number, p: Pedido) => {
    const nueva = item.cantidad + delta;
    if (nueva < 1) return;
    await supabase.from("items_pedido").update({ cantidad: nueva }).eq("id", item.id);
    const next = items.map((i) => i.id === item.id ? { ...i, cantidad: nueva } : i);
    setItems(next);
    recalcularPedido(p.id, next, p.envio);
  };

  const borrarItem = async (item: Item, p: Pedido) => {
    if (!confirm(`¿Quitar "${item.nombre}"?`)) return;
    await supabase.from("items_pedido").delete().eq("id", item.id);
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    recalcularPedido(p.id, next, p.envio);
    toast.success("Item eliminado");
  };

  const guardarPrecio = async (item: Item, p: Pedido) => {
    if (!editPrecio) return;
    const nuevo = parseFloat(editPrecio.valor.replace(",", "."));
    if (isNaN(nuevo) || nuevo < 0) { toast.error("Precio inválido"); return; }
    await supabase.from("items_pedido").update({ precio_unitario: nuevo }).eq("id", item.id);
    const next = items.map((i) => i.id === item.id ? { ...i, precio_unitario: nuevo } : i);
    setItems(next);
    setEditPrecio(null);
    recalcularPedido(p.id, next, p.envio);
    toast.success("Precio actualizado");
  };

  const guardarTotal = async (p: Pedido) => {
    if (!editTotal) return;
    const nuevo = parseFloat(editTotal.valor.replace(",", "."));
    if (isNaN(nuevo) || nuevo < 0) { toast.error("Total inválido"); return; }
    await supabase.from("pedidos").update({ total: nuevo }).eq("id", p.id);
    setEditTotal(null);
    cargar(fecha);
    toast.success("Total actualizado");
  };

  const cambiarMetodo = async (p: Pedido, metodo: string) => {
    await supabase.from("pedidos").update({ metodo_pago: metodo }).eq("id", p.id);
    cargar(fecha);
  };

  const cambiarEnvio = async (p: Pedido, valor: number) => {
    const subtotal = Number(p.subtotal) || 0;
    await supabase.from("pedidos").update({ envio: valor, total: subtotal + valor }).eq("id", p.id);
    cargar(fecha);
  };

  const borrarPedido = async (p: Pedido) => {
    if (!confirm(`¿Eliminar pedido #${p.numero}? No se puede deshacer.`)) return;
    await supabase.from("items_pedido").delete().eq("pedido_id", p.id);
    await supabase.from("pedidos").delete().eq("id", p.id);
    if (expandido === p.id) { setExpandido(null); setItems([]); }
    cargar(fecha);
    toast.success(`Pedido #${p.numero} eliminado`);
  };

  const stats = useMemo(() => {
    const sum = (arr: Pedido[]) => arr.reduce((s, p) => s + Number(p.total), 0);
    const ef = pedidos.filter((p) => p.metodo_pago === "efectivo");
    const ta = pedidos.filter((p) => p.metodo_pago === "tarjeta");
    const gl = pedidos.filter((p) => p.metodo_pago === "glovo");
    const je = pedidos.filter((p) => p.metodo_pago === "just_eat");
    const ue = pedidos.filter((p) => p.metodo_pago === "uber_eats");
    const sin = pedidos.filter((p) => !p.metodo_pago);
    const local = pedidos.filter((p) => p.tipo === "local");
    const dom = pedidos.filter((p) => p.tipo === "domicilio");
    const tGl = pedidos.filter((p) => p.tipo === "glovo");
    const tJe = pedidos.filter((p) => p.tipo === "just_eat");
    const tUe = pedidos.filter((p) => p.tipo === "uber_eats");
    const envios = pedidos.reduce((s, p) => s + Number(p.envio || 0), 0);
    return {
      total: sum(pedidos),
      count: pedidos.length,
      efectivo: sum(ef),
      tarjeta: sum(ta),
      glovo: sum(gl),
      just_eat: sum(je),
      uber_eats: sum(ue),
      sinMetodo: sum(sin),
      sinMetodoN: sin.length,
      local: { total: sum(local), n: local.length },
      domicilio: { total: sum(dom), n: dom.length },
      tipoGlovo: { total: sum(tGl), n: tGl.length },
      tipoJustEat: { total: sum(tJe), n: tJe.length },
      tipoUberEats: { total: sum(tUe), n: tUe.length },
      envios,
    };
  }, [pedidos]);

  const imprimir = async () => {
    const { printHTML, cierreHTML } = await import("@/lib/ticket");
    const anulados = pedidos.filter((p) => (p as unknown as { estado?: string }).estado === "anulado");
    const validos = pedidos.filter((p) => (p as unknown as { estado?: string }).estado !== "anulado");
    const sum = (arr: typeof pedidos) => arr.reduce((s, p) => s + Number(p.total), 0);
    const sumBy = (k: string) => sum(validos.filter((p) => p.metodo_pago === k));
    const sumTipo = (k: string) => sum(validos.filter((p) => p.tipo === k));
    const efectivo = sumBy("efectivo");
    printHTML(cierreHTML({
      fecha,
      efectivo, tarjeta: sumBy("tarjeta"), glovo: sumBy("glovo"),
      just_eat: sumBy("just_eat"), uber_eats: sumBy("uber_eats"),
      envios: validos.reduce((s, p) => s + Number(p.envio || 0), 0),
      descuentos: 0, ajustes: 0,
      anulados: sum(anulados), anuladosN: anulados.length,
      local: sumTipo("local"), domicilio: sumTipo("domicilio"), recoger: 0,
      total: sum(validos), pedidos: validos.length,
      cajaTeorica: efectivo,
    }), `Cierre ${fecha}`);
  };

  // ===== TURNOS =====
  const turnoActivo = useTurnoActivo();
  const [showIniciar, setShowIniciar] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<{ resumen: ResumenTurno; inicio: string; fin: string; turno: TurnoNombre } | null>(null);
  const historial = getHistorialTurnos();

  const calcularResumenTurno = (): ResumenTurno => {
    const inicio = turnoActivo ? new Date(turnoActivo.inicio).getTime() : 0;
    const desde = pedidos.filter((p) => new Date(p.created_at).getTime() >= inicio);
    const sum = (arr: typeof pedidos) => arr.reduce((s, p) => s + Number(p.total), 0);
    const sumBy = (k: string) => sum(desde.filter((p) => p.metodo_pago === k));
    return {
      pedidos: desde.length,
      total: sum(desde),
      efectivo: sumBy("efectivo"),
      tarjeta: sumBy("tarjeta"),
      glovo: sumBy("glovo"),
      just_eat: sumBy("just_eat"),
      uber_eats: sumBy("uber_eats"),
      envios: desde.reduce((s, p) => s + Number(p.envio || 0), 0),
    };
  };

  const onIniciar = (t: TurnoNombre) => {
    iniciarTurno(t);
    setShowIniciar(false);
    toast.success(`▶ Turno ${turnoLabel(t)} iniciado`);
  };

  const onCerrar = () => {
    if (!turnoActivo) return;
    if (!confirm(`¿Cerrar turno ${turnoLabel(turnoActivo.turno)}?`)) return;
    const resumen = calcularResumenTurno();
    const c = cerrarTurnoActivo(resumen);
    if (c) {
      setResumenCierre({ resumen, inicio: c.inicio, fin: c.fin, turno: c.turno });
      toast.success("⏹ Turno cerrado y archivado");
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-3xl font-black">
            <Calculator className="h-7 w-7 text-primary" /> Cierre de jornada
          </h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold"
            />
            <button onClick={() => cargar(fecha)} className="rounded-xl bg-muted p-2 active:scale-95">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={imprimir} className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground active:scale-95">
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
        </div>

        {/* TOTAL */}
        <div className="rounded-3xl bg-primary p-6 text-center text-primary-foreground shadow-lg">
          <div className="text-sm opacity-80">Total del día · {fecha}</div>
          <div className="text-6xl font-black tracking-tight">{eur(stats.total)}</div>
          <div className="mt-1 text-sm opacity-80">{stats.count} pedidos · Envíos cobrados {eur(stats.envios)}</div>
        </div>

        {/* Por método de pago */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Por método de pago</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card icon={<Banknote className="h-5 w-5" />} label="Efectivo" v={stats.efectivo} />
            <Card icon={<CreditCard className="h-5 w-5" />} label="Tarjeta" v={stats.tarjeta} />
            <Card icon={<Bike className="h-5 w-5" />} label="Glovo" v={stats.glovo} />
            <Card icon={<Bike className="h-5 w-5" />} label="Just Eat" v={stats.just_eat} />
          </div>
          {stats.sinMetodoN > 0 && (
            <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              ⚠️ {stats.sinMetodoN} pedido(s) sin método de pago — {eur(stats.sinMetodo)}. Asígnalos abajo.
            </div>
          )}
          <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>💵 Caja física (efectivo)</span><span className="font-black">{eur(stats.efectivo)}</span></div>
            <div className="flex justify-between"><span>💳 Banco (tarjeta)</span><span className="font-black">{eur(stats.tarjeta)}</span></div>
            <div className="flex justify-between"><span>🛵 Plataformas (Glovo + Just Eat)</span><span className="font-black">{eur(stats.glovo + stats.just_eat)}</span></div>
          </div>
        </section>

        {/* Por tipo */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Por tipo de pedido</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card icon={<Home className="h-5 w-5" />} label={`Local (${stats.local.n})`} v={stats.local.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Domicilio (${stats.domicilio.n})`} v={stats.domicilio.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Glovo (${stats.tipoGlovo.n})`} v={stats.tipoGlovo.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Just Eat (${stats.tipoJustEat.n})`} v={stats.tipoJustEat.total} />
          </div>
        </section>

        {/* Listado editable */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Pedidos del día (toca para editar)</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos en esta fecha</p>
          ) : (
            <div className="space-y-2 text-sm">
              {pedidos.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border">
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="flex w-full items-center justify-between p-3 text-left active:scale-[0.99]"
                  >
                    <div>
                      <div className="font-bold">#{p.numero} · {p.tipo}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {p.metodo_pago || "sin método"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-primary">{eur(Number(p.total))}</div>
                      {Number(p.envio || 0) > 0 && (
                        <div className="text-xs text-muted-foreground">+ {eur(Number(p.envio))} envío</div>
                      )}
                    </div>
                  </button>

                  {expandido === p.id && (
                    <div className="space-y-3 border-t border-border bg-muted/30 p-3">
                      {/* Items */}
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Sin items</div>
                        ) : items.map((it) => (
                          <div key={it.id} className="rounded-xl bg-card p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-bold">{it.cantidad}× {it.nombre}</div>
                                {(it.modificaciones?.quitar?.length || 0) > 0 && (
                                  <div className="text-xs text-destructive">− sin {it.modificaciones.quitar!.join(", ")}</div>
                                )}
                                {(it.modificaciones?.extras?.length || 0) > 0 && (
                                  <div className="text-xs text-success">+ {it.modificaciones.extras!.map(e => e.nombre).join(", ")}</div>
                                )}
                              </div>
                              <div className="text-right text-xs">
                                {editPrecio?.id === it.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" step="0.01" autoFocus
                                      value={editPrecio.valor}
                                      onChange={(e) => setEditPrecio({ id: it.id, valor: e.target.value })}
                                      className="w-20 rounded border border-border bg-background px-1 py-0.5 text-right"
                                    />
                                    <button onClick={() => guardarPrecio(it, p)} className="rounded bg-primary p-1 text-primary-foreground"><Check className="h-3 w-3" /></button>
                                    <button onClick={() => setEditPrecio(null)} className="rounded bg-muted p-1"><X className="h-3 w-3" /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setEditPrecio({ id: it.id, valor: String(it.precio_unitario) })}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    {eur(Number(it.precio_unitario))} <Pencil className="inline h-3 w-3" />
                                  </button>
                                )}
                                <div className="font-black text-primary">{eur(lineaTotal(it))}</div>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <button onClick={() => cambiarCantidad(it, -1, p)} className="rounded bg-muted p-1.5 active:scale-95"><Minus className="h-3 w-3" /></button>
                              <button onClick={() => cambiarCantidad(it, +1, p)} className="rounded bg-muted p-1.5 active:scale-95"><Plus className="h-3 w-3" /></button>
                              <div className="flex-1" />
                              <button onClick={() => borrarItem(it, p)} className="rounded bg-destructive/10 p-1.5 text-destructive active:scale-95"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Método pago */}
                      <div>
                        <div className="mb-1 text-xs font-bold text-muted-foreground">Método de pago</div>
                        <div className="grid grid-cols-4 gap-1">
                          {(["efectivo", "tarjeta", "glovo", "just_eat"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => cambiarMetodo(p, m)}
                              className={`rounded-lg py-1.5 text-xs font-bold active:scale-95 ${
                                p.metodo_pago === m ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}
                            >{m}</button>
                          ))}
                        </div>
                      </div>

                      {/* Envío */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Envío</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" step="0.01"
                            defaultValue={Number(p.envio || 0)}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value.replace(",", ".")) || 0;
                              if (v !== Number(p.envio)) cambiarEnvio(p, v);
                            }}
                            className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                          />
                          <span className="text-xs">€</span>
                        </div>
                      </div>

                      {/* Total editable */}
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-card p-2">
                        <span className="text-sm font-black">TOTAL</span>
                        {editTotal?.id === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" step="0.01" autoFocus
                              value={editTotal.valor}
                              onChange={(e) => setEditTotal({ id: p.id, valor: e.target.value })}
                              className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-black"
                            />
                            <button onClick={() => guardarTotal(p)} className="rounded bg-primary p-1.5 text-primary-foreground"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditTotal(null)} className="rounded bg-muted p-1.5"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditTotal({ id: p.id, valor: String(p.total) })}
                            className="flex items-center gap-1 text-lg font-black text-primary"
                          >
                            {eur(Number(p.total))} <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => borrarPedido(p)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-2 text-sm font-bold text-destructive active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" /> Eliminar pedido
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div className="rounded-2xl border border-border bg-muted p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-xl font-black">{eur(v)}</div>
    </div>
  );
}
