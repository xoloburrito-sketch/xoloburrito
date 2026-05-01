import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur } from "@/lib/format";
import { Banknote, CreditCard, Bike, Home, Calculator, Printer, RefreshCw } from "lucide-react";

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

const hoyISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

function CierrePage() {
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = async (f: string) => {
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
  };

  useEffect(() => { cargar(fecha); }, [fecha]);

  const stats = useMemo(() => {
    const sum = (arr: Pedido[]) => arr.reduce((s, p) => s + Number(p.total), 0);
    const ef = pedidos.filter((p) => p.metodo_pago === "efectivo");
    const ta = pedidos.filter((p) => p.metodo_pago === "tarjeta");
    const gl = pedidos.filter((p) => p.metodo_pago === "glovo");
    const je = pedidos.filter((p) => p.metodo_pago === "just_eat");
    const local = pedidos.filter((p) => p.tipo === "local");
    const dom = pedidos.filter((p) => p.tipo === "domicilio");
    const tGl = pedidos.filter((p) => p.tipo === "glovo");
    const tJe = pedidos.filter((p) => p.tipo === "just_eat");
    const envios = pedidos.reduce((s, p) => s + Number(p.envio || 0), 0);
    return {
      total: sum(pedidos),
      count: pedidos.length,
      efectivo: sum(ef),
      tarjeta: sum(ta),
      glovo: sum(gl),
      just_eat: sum(je),
      local: { total: sum(local), n: local.length },
      domicilio: { total: sum(dom), n: dom.length },
      tipoGlovo: { total: sum(tGl), n: tGl.length },
      tipoJustEat: { total: sum(tJe), n: tJe.length },
      envios,
    };
  }, [pedidos]);

  const imprimir = () => window.print();

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

        {/* Listado */}
        <section className="rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Pedidos del día</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos en esta fecha</p>
          ) : (
            <div className="divide-y divide-border text-sm">
              {pedidos.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-bold">#{p.numero} · {p.tipo}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {p.metodo_pago || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-primary">{eur(Number(p.total))}</div>
                    {Number(p.envio || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">+ {eur(Number(p.envio))} envío</div>
                    )}
                  </div>
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
