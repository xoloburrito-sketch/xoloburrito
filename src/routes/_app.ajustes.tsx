import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { obtenerPin, cambiarPin } from "@/lib/pin";
import { toast } from "sonner";
import { useAjustes, setAjustes, resetAjustes, aplicarTema, type Tema } from "@/lib/ajustes";
import { beepTest } from "@/lib/sonidos";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes")({
  component: AjustesPage,
});

function Sec({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-5 text-left active:scale-[0.99]">
        <h2 className="text-lg font-black">{title}</h2>
        <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 border-t border-border p-5">{children}</div>}
    </div>
  );
}

const Inp = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={"w-full rounded-xl border border-border bg-background p-3 text-base " + (p.className || "")} />
);
const Lbl = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-bold uppercase text-muted-foreground">{children}</label>
);

function AjustesPage() {
  const a = useAjustes();
  const [pinActual, setPinActual] = useState(""); const [pinNuevo, setPinNuevo] = useState(""); const [pinConf, setPinConf] = useState("");
  const [efectivoReal, setEfectivoReal] = useState(""); // unused

  const guardar = (patch: Partial<typeof a>) => { setAjustes(patch); toast.success("✅ Guardado"); };

  const cambiarPinHandler = () => {
    if (pinActual !== obtenerPin()) { toast.error("PIN actual incorrecto"); return; }
    if (!/^\d{4}$/.test(pinNuevo)) { toast.error("El PIN debe tener 4 dígitos"); return; }
    if (pinNuevo !== pinConf) { toast.error("Los PIN no coinciden"); return; }
    cambiarPin(pinNuevo);
    setPinActual(""); setPinNuevo(""); setPinConf("");
    toast.success("✅ PIN actualizado");
  };

  const subirLogo = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { guardar({ logoBase64: String(r.result) }); };
    r.readAsDataURL(f);
  };

  const probarImpresora = async () => {
    if (!a.printerIP) { toast.error("Configura una IP"); return; }
    try {
      const url = `http://${a.printerIP}:${a.printerPort}/`;
      await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(3000) });
      toast.success("✅ Solicitud enviada (revisa la impresora)");
    } catch {
      toast.error("❌ Sin respuesta — revisa la IP");
    }
  };

  const onTema = (t: Tema) => { setAjustes({ tema: t }); aplicarTema(t); toast.success("Tema aplicado"); };

  const onReset = () => {
    if (!confirm("¿Restablecer todos los ajustes a los valores por defecto?")) return;
    resetAjustes();
    toast.success("Valores restablecidos");
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black">Ajustes</h1>
          <button onClick={onReset} className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive active:scale-95">↩ Restablecer</button>
        </div>

        <Sec title="🏪 Negocio" defaultOpen>
          <div><Lbl>Nombre del restaurante</Lbl><Inp value={a.nombreNegocio} onChange={(e) => setAjustes({ nombreNegocio: e.target.value })} /></div>
          <div><Lbl>Dirección</Lbl><Inp value={a.direccionNegocio} onChange={(e) => setAjustes({ direccionNegocio: e.target.value })} /></div>
          <div><Lbl>Teléfono</Lbl><Inp value={a.telefonoNegocio} onChange={(e) => setAjustes({ telefonoNegocio: e.target.value })} /></div>
          <div><Lbl>CIF/NIF</Lbl><Inp value={a.cifNegocio} onChange={(e) => setAjustes({ cifNegocio: e.target.value })} /></div>
          <div>
            <Lbl>Logo</Lbl>
            <div className="flex items-center gap-3">
              {a.logoBase64 && <img src={a.logoBase64} alt="logo" className="h-16 w-16 rounded-xl bg-white object-contain p-1" />}
              <input type="file" accept="image/*" onChange={(e) => subirLogo(e.target.files?.[0] || null)} className="text-sm" />
              {a.logoBase64 && <button onClick={() => guardar({ logoBase64: "" })} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold">Quitar</button>}
            </div>
          </div>
          <button onClick={() => toast.success("✅ Guardado")} className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">💾 Guardar</button>
        </Sec>

        <Sec title="🔐 Seguridad (PIN)">
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="PIN actual" value={pinActual} onChange={(e) => setPinActual(e.target.value)} />
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="PIN nuevo (4 dígitos)" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} />
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="Confirmar PIN nuevo" value={pinConf} onChange={(e) => setPinConf(e.target.value)} />
          <button onClick={cambiarPinHandler} className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">Cambiar PIN</button>
        </Sec>

        <Sec title="💶 Facturación">
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl>IVA por defecto (%)</Lbl><Inp type="number" step="0.01" value={a.iva} onChange={(e) => setAjustes({ iva: parseFloat(e.target.value) || 0 })} /></div>
            <div><Lbl>Moneda (símbolo)</Lbl>
              <select value={["€","$","£"].includes(a.moneda) ? a.moneda : "otro"} onChange={(e) => { const v = e.target.value; if (v !== "otro") setAjustes({ moneda: v }); }} className="w-full rounded-xl border border-border bg-background p-3">
                <option value="€">€</option><option value="$">$</option><option value="£">£</option><option value="otro">Otro</option>
              </select>
              <Inp value={a.moneda} onChange={(e) => setAjustes({ moneda: e.target.value })} className="mt-2" />
            </div>
            <div><Lbl>Precio de envío</Lbl><Inp type="number" step="0.01" value={a.precioEnvio} onChange={(e) => setAjustes({ precioEnvio: parseFloat(e.target.value) || 0 })} /></div>
            <div><Lbl>Descuento global (%)</Lbl><Inp type="number" step="0.01" value={a.descuentoGlobal} onChange={(e) => setAjustes({ descuentoGlobal: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <button onClick={() => toast.success("✅ Guardado")} className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">💾 Guardar</button>
        </Sec>

        <Sec title="🕐 Turnos">
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl>Turno 1 — Nombre</Lbl><Inp value={a.turno1Nombre} onChange={(e) => setAjustes({ turno1Nombre: e.target.value })} /></div>
            <div><Lbl>Hora inicio</Lbl><Inp type="time" value={a.turno1Hora} onChange={(e) => setAjustes({ turno1Hora: e.target.value })} /></div>
            <div><Lbl>Turno 2 — Nombre</Lbl><Inp value={a.turno2Nombre} onChange={(e) => setAjustes({ turno2Nombre: e.target.value })} /></div>
            <div><Lbl>Hora inicio</Lbl><Inp type="time" value={a.turno2Hora} onChange={(e) => setAjustes({ turno2Hora: e.target.value })} /></div>
          </div>
        </Sec>

        <Sec title="🖨️ Impresora">
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl>IP / nombre</Lbl><Inp placeholder="192.168.1.50" value={a.printerIP} onChange={(e) => setAjustes({ printerIP: e.target.value })} /></div>
            <div><Lbl>Puerto</Lbl><Inp type="number" value={a.printerPort} onChange={(e) => setAjustes({ printerPort: parseInt(e.target.value) || 9100 })} /></div>
            <div className="col-span-2"><Lbl>Formato papel</Lbl>
              <div className="grid grid-cols-2 gap-2">
                {(["58mm","80mm"] as const).map((p) => (
                  <button key={p} onClick={() => setAjustes({ papel: p })} className={`rounded-xl py-3 font-bold ${a.papel === p ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{p}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={probarImpresora} className="w-full rounded-2xl bg-secondary py-3 font-black text-secondary-foreground active:scale-95">🖨️ Probar conexión</button>
        </Sec>

        <Sec title="🎨 Apariencia">
          <div className="grid grid-cols-3 gap-3">
            {([
              { k: "dark" as Tema, label: "🌑 Oscuro", bg: "#1a1a1a", fg: "#fff" },
              { k: "light" as Tema, label: "☀️ Claro", bg: "#fff", fg: "#111" },
              { k: "rojo" as Tema, label: "🔴 Rojo/Negro", bg: "#1a1a1a", fg: "#E63946" },
            ]).map((t) => (
              <button key={t.k} onClick={() => onTema(t.k)} className={`rounded-2xl border-2 p-3 text-center text-sm font-black transition ${a.tema === t.k ? "border-primary" : "border-border"}`}>
                <div className="mb-2 h-12 w-full rounded-lg" style={{ background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>Aa</div>
                {t.label}
              </button>
            ))}
          </div>
        </Sec>

        <Sec title="🔊 Sonidos">
          <Toggle label="Sonido al añadir producto" v={a.sonidoAdd} onChange={(v) => setAjustes({ sonidoAdd: v })} />
          <Toggle label="Sonido al cobrar pedido" v={a.sonidoCobro} onChange={(v) => setAjustes({ sonidoCobro: v })} />
          <button onClick={beepTest} className="w-full rounded-2xl bg-muted py-3 font-bold active:scale-95">🔔 Probar sonido</button>
        </Sec>

        <Sec title="🧾 Ticket">
          <div><Lbl>Cabecera (header)</Lbl><textarea value={a.ticketHeader} onChange={(e) => setAjustes({ ticketHeader: e.target.value })} rows={2} className="w-full rounded-xl border border-border bg-background p-3" /></div>
          <div><Lbl>Pie (footer)</Lbl><textarea value={a.ticketFooter} onChange={(e) => setAjustes({ ticketFooter: e.target.value })} rows={2} className="w-full rounded-xl border border-border bg-background p-3" /></div>
          <Toggle label="Mostrar IVA desglosado" v={a.mostrarIVA} onChange={(v) => setAjustes({ mostrarIVA: v })} />
          <Toggle label="Mostrar logo en ticket" v={a.mostrarLogo} onChange={(v) => setAjustes({ mostrarLogo: v })} />
        </Sec>

        <p className="pb-6 text-center text-xs text-muted-foreground">Los cambios se guardan automáticamente. PIN por defecto: <b>1234</b>.</p>
      </div>
    </div>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!v)} className="flex w-full items-center justify-between rounded-xl bg-muted p-3 active:scale-[0.99]">
      <span className="font-bold">{label}</span>
      <span className={`relative inline-block h-7 w-12 rounded-full ${v ? "bg-success" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${v ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
