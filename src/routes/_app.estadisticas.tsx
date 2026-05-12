import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { eur } from "@/lib/format";
import { getHistorialTurnos, borrarHistorialTurnos, turnoLabel, type CierreTurno } from "@/lib/turnos";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ArrowLeft, Download, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/estadisticas")({
  component: EstadisticasPage,
});

const COLORS = ["#22c55e", "#3b82f6", "#f97316", "#ef4444", "#a855f7", "#eab308"];

function EstadisticasPage() {
  const [hist, setHist] = useState<CierreTurno[]>(getHistorialTurnos());
  const [detalle, setDetalle] = useState<CierreTurno | null>(null);

  const stats = useMemo(() => {
    if (!hist.length) return null;
    const sum = (f: (c: CierreTurno) => number) => hist.reduce((s, c) => s + (f(c) || 0), 0);
    const pedidos = sum((c) => c.resumen.pedidos);
    const total = sum((c) => c.resumen.total);
    const efectivo = sum((c) => c.resumen.efectivo);
    const tarjeta = sum((c) => c.resumen.tarjeta);
    const glovo = sum((c) => c.resumen.glovo);
    const just_eat = sum((c) => c.resumen.just_eat);
    const uber_eats = sum((c) => c.resumen.uber_eats);
    const local = sum((c) => c.resumen.local || 0);
    const dom = sum((c) => c.resumen.domicilio || 0);
    const anulados = sum((c) => c.resumen.anulados || 0);

    // Por día (agregado)
    const porDia = new Map<string, number>();
    for (const c of hist) {
      const d = (c.fin || c.inicio).slice(0, 10);
      porDia.set(d, (porDia.get(d) || 0) + (c.resumen.total || 0));
    }
    const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
    const last14 = dias.slice(-14).map(([fecha, total]) => ({ fecha: fecha.slice(5), total: Math.round(total * 100) / 100 }));
    const last30 = dias.slice(-30).map(([fecha, total]) => ({ fecha: fecha.slice(5), total: Math.round(total * 100) / 100 }));
    const mejorDia = [...dias].sort((a, b) => b[1] - a[1])[0];

    // Top productos
    const prodMap = new Map<string, { unidades: number; total: number }>();
    for (const c of hist) for (const p of c.resumen.top_productos || []) {
      const cur = prodMap.get(p.nombre) || { unidades: 0, total: 0 };
      cur.unidades += p.unidades; cur.total += p.total;
      prodMap.set(p.nombre, cur);
    }
    const topProductos = [...prodMap.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.unidades - a.unidades).slice(0, 5);

    const canalData = [
      { name: "Local", value: local },
      { name: "Domicilio", value: dom },
      { name: "Glovo", value: glovo },
      { name: "Just Eat", value: just_eat },
      { name: "Uber Eats", value: uber_eats },
    ].filter((c) => c.value > 0);

    return {
      pedidos, total,
      efectivo, tarjeta, glovo, just_eat, uber_eats,
      local, dom, anulados,
      ticketMedio: pedidos ? total / pedidos : 0,
      mejorDia: mejorDia ? { fecha: mejorDia[0], total: mejorDia[1] } : null,
      last14, last30,
      topProductos,
      canalData,
    };
  }, [hist]);

  const exportarCSV = () => {
    const cols = ["fecha","turno","inicio","fin","pedidos","total","efectivo","tarjeta","glovo","just_eat","uber_eats","envios","anulados","efectivo_real","diferencia"];
    const rows = hist.map((c) => [
      (c.fin || c.inicio).slice(0, 10),
      turnoLabel(c.turno),
      new Date(c.inicio).toLocaleString("es-ES"),
      new Date(c.fin).toLocaleString("es-ES"),
      c.resumen.pedidos, c.resumen.total, c.resumen.efectivo, c.resumen.tarjeta,
      c.resumen.glovo, c.resumen.just_eat, c.resumen.uber_eats, c.resumen.envios,
      c.resumen.anulados || 0, c.resumen.efectivo_real ?? "", c.resumen.diferencia ?? "",
    ]);
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cierres-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  const borrar = () => {
    if (!confirm("¿Borrar TODO el historial de cierres? Esta acción es irreversible.")) return;
    if (!confirm("Confirmación final: ¿estás absolutamente seguro?")) return;
    borrarHistorialTurnos();
    setHist([]);
    toast.success("Historial borrado");
  };

  if (!hist.length) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <div className="mb-4 text-6xl">📈</div>
          <h1 className="mb-2 text-2xl font-black">Sin estadísticas todavía</h1>
          <p className="mb-6 text-muted-foreground">Aún no hay cierres registrados. Cierra tu primer turno para ver estadísticas.</p>
          <Link to="/cierre" className="inline-block rounded-2xl bg-primary px-6 py-3 font-black text-primary-foreground">← Ir a Cierre</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/cierre" className="rounded-xl bg-muted p-2"><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="text-3xl font-black">📈 Estadísticas globales</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarCSV} className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground active:scale-95"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground active:scale-95"><Printer className="h-4 w-4" /> Imprimir</button>
            <button onClick={borrar} className="flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive active:scale-95"><Trash2 className="h-4 w-4" /> Borrar</button>
          </div>
        </div>

        {/* Resumen acumulado */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Total ventas" v={eur(stats!.total)} />
          <Kpi label="Pedidos" v={String(stats!.pedidos)} />
          <Kpi label="Ticket medio" v={eur(stats!.ticketMedio)} />
          <Kpi label="Mejor día" v={stats!.mejorDia ? `${stats!.mejorDia.fecha.slice(5)} · ${eur(stats!.mejorDia.total)}` : "—"} />
          <Kpi label="Anulaciones" v={eur(stats!.anulados)} />
          <Kpi label="Cierres" v={String(hist.length)} />
        </div>

        {/* Gráfico ventas por día */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Ventas últimos 14 días</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats!.last14}>
                <XAxis dataKey="fecha" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Evolución 30 días</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats!.last30}>
                <XAxis dataKey="fecha" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top productos */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Top 5 productos</h2>
          {stats!.topProductos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay datos de productos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th>#</th><th>Producto</th><th className="text-right">Ud.</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {stats!.topProductos.map((p, i) => (
                  <tr key={p.nombre} className="border-t border-border">
                    <td className="py-2 font-black">{i + 1}</td>
                    <td>{p.nombre}</td>
                    <td className="text-right font-bold">{p.unidades}</td>
                    <td className="text-right font-bold text-primary">{eur(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Por canal */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-black">Por canal de venta</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats!.canalData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {stats!.canalData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {stats!.canalData.map((c) => (
                  <tr key={c.name} className="border-t border-border">
                    <td className="py-1">{c.name}</td>
                    <td className="text-right font-bold">{eur(c.value)}</td>
                    <td className="text-right text-muted-foreground">{stats!.total ? Math.round((c.value / stats!.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-black">Por método de pago</h2>
            {(() => {
              const data = [
                { name: "Efectivo", value: stats!.efectivo },
                { name: "Tarjeta", value: stats!.tarjeta },
                { name: "Glovo", value: stats!.glovo },
                { name: "Just Eat", value: stats!.just_eat },
                { name: "Uber Eats", value: stats!.uber_eats },
              ].filter((d) => d.value > 0);
              return (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
                          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {data.map((c) => (
                        <tr key={c.name} className="border-t border-border">
                          <td className="py-1">{c.name}</td>
                          <td className="text-right font-bold">{eur(c.value)}</td>
                          <td className="text-right text-muted-foreground">{stats!.total ? Math.round((c.value / stats!.total) * 100) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}
          </div>
        </section>

        {/* Histórico */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Histórico de cierres</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th>Fecha</th><th>Turno</th><th>Inicio</th><th>Fin</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {hist.map((c, i) => (
                  <tr key={`${c.inicio}-${c.fin}-${i}`} className="cursor-pointer border-t border-border hover:bg-muted" onClick={() => setDetalle(c)}>
                    <td className="py-2">{(c.fin || c.inicio).slice(0, 10)}</td>
                    <td className="font-bold">{turnoLabel(c.turno)}</td>
                    <td>{new Date(c.inicio).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{new Date(c.fin).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="text-right font-black text-primary">{eur(c.resumen.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDetalle(null)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-xl font-black">Cierre {turnoLabel(detalle.turno)} · {(detalle.fin || detalle.inicio).slice(0,10)}</h3>
            <div className="mb-3 text-xs text-muted-foreground">{new Date(detalle.inicio).toLocaleString("es-ES")} → {new Date(detalle.fin).toLocaleString("es-ES")}</div>
            <div className="space-y-1 rounded-2xl bg-muted p-4 text-sm">
              <Row label="Pedidos" v={String(detalle.resumen.pedidos)} />
              <Row label="Efectivo" v={eur(detalle.resumen.efectivo)} />
              <Row label="Tarjeta" v={eur(detalle.resumen.tarjeta)} />
              <Row label="Glovo" v={eur(detalle.resumen.glovo)} />
              <Row label="Just Eat" v={eur(detalle.resumen.just_eat)} />
              <Row label="Uber Eats" v={eur(detalle.resumen.uber_eats)} />
              <Row label="Envíos" v={eur(detalle.resumen.envios)} />
              {detalle.resumen.efectivo_real != null && <Row label="Efectivo real" v={eur(detalle.resumen.efectivo_real)} />}
              {detalle.resumen.diferencia != null && <Row label="Diferencia" v={eur(detalle.resumen.diferencia)} />}
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-black">TOTAL</span>
                <span className="text-2xl font-black text-primary">{eur(detalle.resumen.total)}</span>
              </div>
            </div>
            <button onClick={() => setDetalle(null)} className="mt-4 w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black">{v}</div>
    </div>
  );
}
function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-bold">{v}</span></div>;
}
