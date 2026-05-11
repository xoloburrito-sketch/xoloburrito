import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import {
  Banknote, CreditCard, Bike, Home, Calculator, Printer, RefreshCw,
  Trash2, Pencil, Check, X, Plus, Minus, Play, Square, BarChart3,
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
  const [ahora, setAhora] = useState<Date>(new Date());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editTotal, setEditTotal] = useState<{ id: string; valor: string } | null>(null);
  const [editPrecio, setEditPrecio] = useState<{ id: string; valor: string } | null>(null);

  // Reloj y fecha en vivo: actualiza cada minuto y al recibir foco
  useEffect(() => {
    const tick = () => { setAhora(new Date()); setFecha(hoyISO()); };
    const id = setInterval(tick, 60_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);

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
  const [efectivoReal, setEfectivoReal] = useState<string>("");
  const historial = getHistorialTurnos();

  const calcularResumenTurno = async (): Promise<ResumenTurno> => {
    const inicio = turnoActivo ? new Date(turnoActivo.inicio).getTime() : 0;
    const desde = pedidos.filter((p) => new Date(p.created_at).getTime() >= inicio);
    const sum = (arr: typeof pedidos) => arr.reduce((s, p) => s + Number(p.total), 0);
    const sumBy = (k: string) => sum(desde.filter((p) => p.metodo_pago === k));
    const sumTipo = (k: string) => sum(desde.filter((p) => p.tipo === k));

    // Top productos del turno (consulta items)
    let top_productos: { nombre: string; unidades: number; total: number }[] = [];
    if (desde.length) {
      const ids = desde.map((p) => p.id);
      const { data } = await supabase.from("items_pedido").select("nombre,cantidad,precio_unitario,modificaciones").in("pedido_id", ids);
      const map = new Map<string, { unidades: number; total: number }>();
      for (const it of (data as Item[] | null) || []) {
        const cur = map.get(it.nombre) || { unidades: 0, total: 0 };
        cur.unidades += it.cantidad;
        cur.total += lineaTotal(it);
        map.set(it.nombre, cur);
      }
      top_productos = [...map.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
    }

    const efectivo = sumBy("efectivo");
    const efectivo_real = parseFloat(efectivoReal.replace(",", ".")) || 0;
    return {
      pedidos: desde.length,
      total: sum(desde),
      efectivo,
      tarjeta: sumBy("tarjeta"),
      glovo: sumBy("glovo"),
      just_eat: sumBy("just_eat"),
      uber_eats: sumBy("uber_eats"),
      envios: desde.reduce((s, p) => s + Number(p.envio || 0), 0),
      local: sumTipo("local"),
      domicilio: sumTipo("domicilio"),
      anulados: 0,
      ticket_medio: desde.length ? sum(desde) / desde.length : 0,
      top_productos,
      efectivo_real: efectivoReal ? efectivo_real : undefined,
      diferencia: efectivoReal ? (efectivo_real - efectivo) : undefined,
    };
  };

  const onIniciar = (t: TurnoNombre) => {
    iniciarTurno(t);
    setShowIniciar(false);
    toast.success(`▶ Turno ${turnoLabel(t)} iniciado`);
  };

  const onCerrar = async () => {
    if (!turnoActivo) return;
    if (!confirm(`¿Cerrar turno ${turnoLabel(turnoActivo.turno)}?`)) return;
    const resumen = await calcularResumenTurno();
    const c = cerrarTurnoActivo(resumen);
    if (c) {
      setResumenCierre({ resumen, inicio: c.inicio, fin: c.fin, turno: c.turno });
      setEfectivoReal("");
      toast.success("⏹ Turno cerrado y archivado");
    }
  };

  const efectivoTeorico = useMemo(() => {
    if (!turnoActivo) return stats.efectivo;
    const inicio = new Date(turnoActivo.inicio).getTime();
    return pedidos.filter((p) => new Date(p.created_at).getTime() >= inicio && p.metodo_pago === "efectivo")
      .reduce((s, p) => s + Number(p.total), 0);
  }, [pedidos, turnoActivo, stats.efectivo]);
  const efectivoRealNum = parseFloat(efectivoReal.replace(",", ".")) || 0;
  const diferencia = efectivoRealNum - efectivoTeorico;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-black">
              <Calculator className="h-7 w-7 text-primary" /> Cierre de jornada
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">
                {ahora.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
              <span>·</span>
              <span className="font-mono font-bold">
                {ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> En directo
              </span>
            </div>
          </div>
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

        {/* TURNOS */}
        <section className="no-print rounded-3xl bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-muted-foreground">Turno</div>
              {turnoActivo ? (
                <div className="text-lg font-black">
                  🟢 {turnoLabel(turnoActivo.turno)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    Inicio: {new Date(turnoActivo.inicio).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ) : (
                <div className="text-lg font-black text-muted-foreground">⚪ Sin turno activo</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowIniciar(true)}
                disabled={!!turnoActivo}
                className="flex items-center gap-2 rounded-2xl bg-success px-4 py-3 text-sm font-black text-success-foreground shadow active:scale-95 disabled:opacity-40"
              >
                <Play className="h-4 w-4" /> Iniciar turno
              </button>
              <button
                onClick={onCerrar}
                disabled={!turnoActivo}
                className="flex items-center gap-2 rounded-2xl bg-destructive px-4 py-3 text-sm font-black text-destructive-foreground shadow active:scale-95 disabled:opacity-40"
              >
                <Square className="h-4 w-4" /> Cerrar turno
              </button>
            </div>
          </div>
          {historial.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              Último cierre: {turnoLabel(historial[0].turno)} · {new Date(historial[0].fin).toLocaleString("es-ES")} · {eur(historial[0].resumen.total)}
            </div>
          )}

          {/* Arqueo de caja */}
          <div className="mt-4 rounded-2xl bg-muted p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black">🧮 Arqueo de caja</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Efectivo teórico</div>
                <div className="text-lg font-black">{eur(efectivoTeorico)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Efectivo real</div>
                <input type="number" step="0.01" placeholder="0.00" value={efectivoReal} onChange={(e) => setEfectivoReal(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-lg font-black" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Diferencia</div>
                <div className={`text-lg font-black ${diferencia === 0 ? "" : diferencia > 0 ? "text-success" : "text-destructive"}`}>
                  {efectivoReal ? `${diferencia >= 0 ? "+" : ""}${eur(diferencia)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Estadísticas globales */}
        <Link to="/estadisticas" className="flex items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-success to-primary p-5 text-lg font-black text-primary-foreground shadow-lg active:scale-[0.99]">
          <BarChart3 className="h-6 w-6" /> 📈 Estadísticas globales
        </Link>

        {/* TOTAL */}
        <div className="rounded-3xl bg-primary p-6 text-center text-primary-foreground shadow-lg">
          <div className="text-sm opacity-80">Total del día · {fecha}</div>
          <div className="text-6xl font-black tracking-tight">{eur(stats.total)}</div>
          <div className="mt-1 text-sm opacity-80">{stats.count} pedidos · Envíos cobrados {eur(stats.envios)}</div>
        </div>

        {/* Por método de pago */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Por método de pago</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card icon={<Banknote className="h-5 w-5" />} label="Efectivo" v={stats.efectivo} />
            <Card icon={<CreditCard className="h-5 w-5" />} label="Tarjeta" v={stats.tarjeta} />
            <Card icon={<Bike className="h-5 w-5" />} label="Glovo" v={stats.glovo} />
            <Card icon={<Bike className="h-5 w-5" />} label="Just Eat" v={stats.just_eat} />
            <Card icon={<span>🛵</span>} label="Uber Eats" v={stats.uber_eats} />
          </div>
          {stats.sinMetodoN > 0 && (
            <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              ⚠️ {stats.sinMetodoN} pedido(s) sin método de pago — {eur(stats.sinMetodo)}. Asígnalos abajo.
            </div>
          )}
          <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>💵 Caja física (efectivo)</span><span className="font-black">{eur(stats.efectivo)}</span></div>
            <div className="flex justify-between"><span>💳 Banco (tarjeta)</span><span className="font-black">{eur(stats.tarjeta)}</span></div>
            <div className="flex justify-between"><span>🛵 Plataformas (Glovo + Just Eat + Uber Eats)</span><span className="font-black">{eur(stats.glovo + stats.just_eat + stats.uber_eats)}</span></div>
          </div>
        </section>

        {/* Por tipo */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Por tipo de pedido</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card icon={<Home className="h-5 w-5" />} label={`Local (${stats.local.n})`} v={stats.local.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Domicilio (${stats.domicilio.n})`} v={stats.domicilio.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Glovo (${stats.tipoGlovo.n})`} v={stats.tipoGlovo.total} />
            <Card icon={<Bike className="h-5 w-5" />} label={`Just Eat (${stats.tipoJustEat.n})`} v={stats.tipoJustEat.total} />
            <Card icon={<span>🛵</span>} label={`Uber Eats (${stats.tipoUberEats.n})`} v={stats.tipoUberEats.total} />
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

      {/* Modal: Iniciar turno */}
      {showIniciar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowIniciar(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-xl font-black">▶ Iniciar turno</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onIniciar("tarde")} className="rounded-2xl bg-primary p-6 text-lg font-black text-primary-foreground active:scale-95">🌅 TARDE</button>
              <button onClick={() => onIniciar("noche")} className="rounded-2xl bg-secondary p-6 text-lg font-black text-secondary-foreground active:scale-95">🌙 NOCHE</button>
            </div>
            <button onClick={() => setShowIniciar(false)} className="mt-4 w-full rounded-2xl bg-muted py-3 font-bold active:scale-95">Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal: Resumen de cierre de turno */}
      {resumenCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setResumenCierre(null)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-xl font-black">⏹ Cierre de turno {turnoLabel(resumenCierre.turno)}</h3>
            <div className="mb-4 text-xs text-muted-foreground">
              {new Date(resumenCierre.inicio).toLocaleTimeString("es-ES")} → {new Date(resumenCierre.fin).toLocaleTimeString("es-ES")}
              {" · "}{duracionMinutos(resumenCierre.inicio, resumenCierre.fin)} min
            </div>
            <div className="space-y-1 rounded-2xl bg-muted p-4 text-sm">
              <Row label="Pedidos" v={`${resumenCierre.resumen.pedidos}`} />
              <Row label="Efectivo" v={eur(resumenCierre.resumen.efectivo)} />
              <Row label="Tarjeta" v={eur(resumenCierre.resumen.tarjeta)} />
              <Row label="Glovo" v={eur(resumenCierre.resumen.glovo)} />
              <Row label="Just Eat" v={eur(resumenCierre.resumen.just_eat)} />
              <Row label="🛵 Uber Eats" v={eur(resumenCierre.resumen.uber_eats)} />
              <Row label="Envíos" v={eur(resumenCierre.resumen.envios)} />
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-black">TOTAL</span>
                <span className="text-2xl font-black text-primary">{eur(resumenCierre.resumen.total)}</span>
              </div>
            </div>
            <button onClick={() => setResumenCierre(null)} className="mt-4 w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-bold">{v}</span></div>;
}

function Card({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div className="rounded-2xl border border-border bg-muted p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-xl font-black">{eur(v)}</div>
    </div>
  );
}
