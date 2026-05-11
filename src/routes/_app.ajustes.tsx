import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { obtenerPin, cambiarPin } from "@/lib/pin";
import { toast } from "sonner";
import { useAjustes, setAjustes, resetAjustes, aplicarTema, type Tema } from "@/lib/ajustes";
import { beepTest } from "@/lib/sonidos";
import { ChevronDown, Plus, Trash2, Pencil, Printer as PrinterIcon } from "lucide-react";
import {
  useImpresoras, saveImpresoras, nuevaImpresora, testImpresora,
  ROL_LABEL, TIPO_LABEL, type Impresora, type ImpresoraTipo, type ImpresoraRol, type ImpresoraPapel,
} from "@/lib/impresoras";
import {
  usePlantilla, savePlantilla, resetPlantilla,
  separadorChars, tamCocinaPx, type Plantilla,
} from "@/lib/plantilla";
import { printTicket3Copias, ticketHTML, comandaCocinaHTML } from "@/lib/ticket";

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

  const onTema = (t: Tema) => { setAjustes({ tema: t }); aplicarTema(t); toast.success("Tema aplicado"); };

  const onReset = () => {
    if (!confirm("¿Restablecer todos los ajustes a los valores por defecto?")) return;
    resetAjustes();
    toast.success("Valores restablecidos");
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
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
            <div className="flex flex-wrap items-center gap-3">
              {a.logoBase64 && <img src={a.logoBase64} alt="logo" className="h-16 w-16 rounded-xl bg-white object-contain p-1" />}
              <input type="file" accept="image/*" onChange={(e) => subirLogo(e.target.files?.[0] || null)} className="text-sm" />
              {a.logoBase64 && <button onClick={() => guardar({ logoBase64: "" })} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold">Quitar</button>}
            </div>
          </div>
        </Sec>

        <Sec title="🔐 Seguridad (PIN)">
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="PIN actual" value={pinActual} onChange={(e) => setPinActual(e.target.value)} />
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="PIN nuevo (4 dígitos)" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} />
          <Inp type="password" inputMode="numeric" maxLength={4} placeholder="Confirmar PIN nuevo" value={pinConf} onChange={(e) => setPinConf(e.target.value)} />
          <button onClick={cambiarPinHandler} className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">Cambiar PIN</button>
        </Sec>

        <Sec title="💶 Facturación">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Lbl>IVA por defecto (%)</Lbl><Inp type="number" step="0.01" value={a.iva} onChange={(e) => setAjustes({ iva: parseFloat(e.target.value) || 0 })} /></div>
            <div><Lbl>Moneda (símbolo)</Lbl><Inp value={a.moneda} onChange={(e) => setAjustes({ moneda: e.target.value })} /></div>
            <div><Lbl>Precio de envío</Lbl><Inp type="number" step="0.01" value={a.precioEnvio} onChange={(e) => setAjustes({ precioEnvio: parseFloat(e.target.value) || 0 })} /></div>
            <div><Lbl>Descuento global (%)</Lbl><Inp type="number" step="0.01" value={a.descuentoGlobal} onChange={(e) => setAjustes({ descuentoGlobal: parseFloat(e.target.value) || 0 })} /></div>
          </div>
        </Sec>

        <Sec title="🕐 Turnos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Lbl>Turno 1 — Nombre</Lbl><Inp value={a.turno1Nombre} onChange={(e) => setAjustes({ turno1Nombre: e.target.value })} /></div>
            <div><Lbl>Hora inicio</Lbl><Inp type="time" value={a.turno1Hora} onChange={(e) => setAjustes({ turno1Hora: e.target.value })} /></div>
            <div><Lbl>Turno 2 — Nombre</Lbl><Inp value={a.turno2Nombre} onChange={(e) => setAjustes({ turno2Nombre: e.target.value })} /></div>
            <div><Lbl>Hora inicio</Lbl><Inp type="time" value={a.turno2Hora} onChange={(e) => setAjustes({ turno2Hora: e.target.value })} /></div>
          </div>
        </Sec>

        <Sec title="🖨️ Impresoras"><GestorImpresoras /></Sec>

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

        <Sec title="🧾 Editor de Tickets"><EditorTickets /></Sec>

        <p className="pb-6 text-center text-xs text-muted-foreground">Los cambios se guardan automáticamente. PIN por defecto: <b>1234</b>.</p>
      </div>
    </div>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!v)} className="flex w-full items-center justify-between rounded-xl bg-muted p-3 active:scale-[0.99]">
      <span className="font-bold text-left">{label}</span>
      <span className={`relative inline-block h-7 w-12 shrink-0 rounded-full ${v ? "bg-success" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${v ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/* ============ GESTOR IMPRESORAS ============ */
function GestorImpresoras() {
  const lista = useImpresoras();
  const [editId, setEditId] = useState<string | null>(null);

  const add = () => {
    if (lista.length >= 6) { toast.error("Máximo 6 impresoras"); return; }
    const nueva = nuevaImpresora();
    saveImpresoras([...lista, nueva]);
    setEditId(nueva.id);
  };

  const update = (id: string, patch: Partial<Impresora>) => {
    saveImpresoras(lista.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const remove = (id: string) => {
    if (!confirm("¿Eliminar esta impresora?")) return;
    saveImpresoras(lista.filter((p) => p.id !== id));
  };

  const test = async (p: Impresora) => {
    toast.loading(`Enviando test a ${p.nombre}…`, { id: "test" });
    const ok = await testImpresora(p);
    toast.dismiss("test");
    if (ok) toast.success(`✅ Test enviado a ${p.nombre}`);
    else toast.error(`❌ No se pudo conectar (${TIPO_LABEL[p.tipo]})`);
  };

  return (
    <div className="space-y-3">
      {lista.length === 0 && (
        <div className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
          Sin impresoras configuradas. Se usará la impresión del sistema.
        </div>
      )}
      {lista.map((p) => {
        const open = editId === p.id;
        return (
          <div key={p.id} className="rounded-2xl border border-border bg-background">
            <div className="flex items-center gap-2 p-3">
              <PrinterIcon className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-bold">{p.nombre}</div>
                <div className="flex flex-wrap gap-1 text-[10px] mt-0.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-bold">{TIPO_LABEL[p.tipo]}</span>
                  <span className="rounded bg-accent px-1.5 py-0.5 font-bold">{ROL_LABEL[p.rol]}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">{p.papel}</span>
                </div>
              </div>
              <button onClick={() => update(p.id, { activa: !p.activa })}
                className={`relative h-6 w-11 shrink-0 rounded-full ${p.activa ? "bg-success" : "bg-border"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${p.activa ? "left-5" : "left-0.5"}`} />
              </button>
              <button onClick={() => test(p)} className="rounded-lg bg-secondary p-2 text-secondary-foreground" title="Test">🖨️</button>
              <button onClick={() => setEditId(open ? null : p.id)} className="rounded-lg bg-muted p-2"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(p.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            {open && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border p-3">
                <div className="sm:col-span-2"><Lbl>Nombre</Lbl><Inp value={p.nombre} onChange={(e) => update(p.id, { nombre: e.target.value })} /></div>
                <div><Lbl>Tipo</Lbl>
                  <select value={p.tipo} onChange={(e) => update(p.id, { tipo: e.target.value as ImpresoraTipo })}
                    className="w-full rounded-xl border border-border bg-background p-3">
                    <option value="lan">Red/LAN (IP)</option>
                    <option value="bluetooth">Bluetooth</option>
                    <option value="usb">USB</option>
                  </select>
                </div>
                <div><Lbl>Rol</Lbl>
                  <select value={p.rol} onChange={(e) => update(p.id, { rol: e.target.value as ImpresoraRol })}
                    className="w-full rounded-xl border border-border bg-background p-3">
                    <option value="cliente">Ticket cliente</option>
                    <option value="cocina">Comanda cocina</option>
                    <option value="negocio">Ticket negocio</option>
                    <option value="todas">Todas las copias</option>
                  </select>
                </div>
                {p.tipo === "lan" && (
                  <>
                    <div><Lbl>IP</Lbl><Inp placeholder="192.168.1.50" value={p.ip || ""} onChange={(e) => update(p.id, { ip: e.target.value })} /></div>
                    <div><Lbl>Puerto</Lbl><Inp type="number" value={p.puerto || 9100} onChange={(e) => update(p.id, { puerto: parseInt(e.target.value) || 9100 })} /></div>
                  </>
                )}
                {p.tipo === "bluetooth" && (
                  <div className="sm:col-span-2"><Lbl>Dispositivo BT</Lbl><Inp placeholder="Nombre dispositivo" value={p.dispositivo_bt || ""} onChange={(e) => update(p.id, { dispositivo_bt: e.target.value })} /></div>
                )}
                <div><Lbl>Papel</Lbl>
                  <select value={p.papel} onChange={(e) => update(p.id, { papel: e.target.value as ImpresoraPapel })}
                    className="w-full rounded-xl border border-border bg-background p-3">
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={add} disabled={lista.length >= 6}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95 disabled:opacity-40">
        <Plus className="h-5 w-5" /> Añadir impresora
      </button>
    </div>
  );
}

/* ============ EDITOR DE TICKETS ============ */
function EditorTickets() {
  const p = usePlantilla();
  const [tab, setTab] = useState<"cliente" | "cocina">("cliente");
  const a = useAjustes();

  const update = (patch: Partial<Plantilla>) => savePlantilla(patch);

  const reset = () => {
    if (!confirm("¿Restablecer plantilla a valores por defecto?")) return;
    resetPlantilla();
    toast.success("Plantilla restablecida");
  };

  const imprimirPrueba = () => {
    const items = [
      { nombre: "Burrito Norteño", cantidad: 2, precio_unitario: 8.5, modificaciones: { quitar: ["cebolla"], extras: [{ nombre: "Guacamole", precio: 1.5 }], notas: "Picante" } },
      { nombre: "Coca-Cola", cantidad: 1, precio_unitario: 2.5, modificaciones: { quitar: [], extras: [], notas: "" } },
    ];
    const subtotal = 2 * (8.5 + 1.5) + 2.5;
    const ticketInner = ticketHTML({
      numero: 999, created_at: new Date().toISOString(), tipo: "local",
      metodo_pago: "efectivo", subtotal, envio: 0, total: subtotal,
      recibido: 25, cambio: 25 - subtotal, cliente: null, notas: null,
    }, items);
    const comandaInner = comandaCocinaHTML({ numero: 999, tipo: "local", created_at: new Date().toISOString() }, items);
    printTicket3Copias({ ticketInner, comandaInner, title: "Ticket de prueba" });
  };

  const previewHTML = useMemo(() => {
    if (tab === "cliente") {
      const items = [
        { nombre: "Burrito Norteño", cantidad: 2, precio_unitario: 8.5, modificaciones: { quitar: ["cebolla"], extras: [{ nombre: "Guacamole", precio: 1.5 }], notas: "Picante" } },
        { nombre: "Coca-Cola", cantidad: 1, precio_unitario: 2.5, modificaciones: { quitar: [], extras: [], notas: "" } },
      ];
      const subtotal = 2 * (8.5 + 1.5) + 2.5;
      return ticketHTML({
        numero: 999, created_at: new Date().toISOString(), tipo: "local",
        metodo_pago: "efectivo", subtotal, envio: 0, total: subtotal,
        recibido: 25, cambio: 25 - subtotal, cliente: null, notas: null,
        turno: "Tarde",
      }, items);
    }
    const items = [
      { nombre: "Burrito Norteño", cantidad: 2, precio_unitario: 8.5, modificaciones: { quitar: ["cebolla"], extras: [{ nombre: "Guacamole", precio: 1.5 }], notas: "Picante" } },
      { nombre: "Coca-Cola", cantidad: 1, precio_unitario: 2.5, modificaciones: { quitar: [], extras: [], notas: "" } },
    ];
    return comandaCocinaHTML({ numero: 999, tipo: "local", created_at: new Date().toISOString() }, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, tab, a]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setTab("cliente")}
          className={`rounded-xl py-2 text-sm font-bold ${tab === "cliente" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          🧾 Ticket cliente
        </button>
        <button onClick={() => setTab("cocina")}
          className={`rounded-xl py-2 text-sm font-bold ${tab === "cocina" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          👨‍🍳 Comanda cocina
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {tab === "cliente" ? (
            <>
              <h3 className="text-sm font-black uppercase text-muted-foreground">Cabecera</h3>
              <Toggle label="Mostrar logo" v={p.mostrarLogo} onChange={(v) => update({ mostrarLogo: v })} />
              <div><Lbl>Nombre del negocio</Lbl><Inp value={p.nombreNegocio} onChange={(e) => update({ nombreNegocio: e.target.value })} /></div>
              <div><Lbl>Dirección</Lbl><Inp value={p.direccion} onChange={(e) => update({ direccion: e.target.value })} /></div>
              <div><Lbl>Teléfono</Lbl><Inp value={p.telefono} onChange={(e) => update({ telefono: e.target.value })} /></div>
              <div><Lbl>CIF/NIF</Lbl><Inp value={p.cif} onChange={(e) => update({ cif: e.target.value })} /></div>
              <div><Lbl>Texto libre cabecera (2 líneas)</Lbl>
                <textarea value={p.textoCabecera} onChange={(e) => update({ textoCabecera: e.target.value })} rows={2}
                  className="w-full rounded-xl border border-border bg-background p-3" />
              </div>
              <div><Lbl>Separador</Lbl>
                <select value={p.separador} onChange={(e) => update({ separador: e.target.value as Plantilla["separador"] })}
                  className="w-full rounded-xl border border-border bg-background p-3">
                  <option value="guiones">-------- (guiones)</option>
                  <option value="iguales">======== (iguales)</option>
                  <option value="puntos">········ (puntos)</option>
                  <option value="ninguno">Ninguno</option>
                </select>
              </div>

              <h3 className="text-sm font-black uppercase text-muted-foreground pt-3">Cuerpo</h3>
              <Toggle label="Mostrar nº de pedido" v={p.mostrarNumPedido} onChange={(v) => update({ mostrarNumPedido: v })} />
              <Toggle label="Mostrar fecha y hora" v={p.mostrarFechaHora} onChange={(v) => update({ mostrarFechaHora: v })} />
              <Toggle label="Mostrar turno" v={p.mostrarTurno} onChange={(v) => update({ mostrarTurno: v })} />
              <Toggle label="Mostrar precio unitario" v={p.mostrarPrecioUnit} onChange={(v) => update({ mostrarPrecioUnit: v })} />
              <Toggle label="Mostrar IVA desglosado" v={p.mostrarIVA} onChange={(v) => update({ mostrarIVA: v })} />
              <div><Lbl>Formato cantidad</Lbl>
                <select value={p.formatoCantidad} onChange={(e) => update({ formatoCantidad: e.target.value as Plantilla["formatoCantidad"] })}
                  className="w-full rounded-xl border border-border bg-background p-3">
                  <option value="antes">2x Burrito</option>
                  <option value="despues">Burrito x2</option>
                </select>
              </div>

              <h3 className="text-sm font-black uppercase text-muted-foreground pt-3">Pie</h3>
              <div><Lbl>Pie línea 1</Lbl><Inp value={p.pie1} onChange={(e) => update({ pie1: e.target.value })} /></div>
              <div><Lbl>Pie línea 2</Lbl><Inp value={p.pie2} onChange={(e) => update({ pie2: e.target.value })} /></div>
              <Toggle label="Mostrar QR" v={p.mostrarQR} onChange={(v) => update({ mostrarQR: v })} />
              {p.mostrarQR && (
                <>
                  <div><Lbl>URL del QR</Lbl><Inp placeholder="https://…" value={p.qrUrl} onChange={(e) => update({ qrUrl: e.target.value })} /></div>
                  <div><Lbl>Texto bajo QR</Lbl><Inp value={p.qrTexto} onChange={(e) => update({ qrTexto: e.target.value })} /></div>
                </>
              )}
            </>
          ) : (
            <>
              <h3 className="text-sm font-black uppercase text-muted-foreground">Comanda de cocina</h3>
              <div><Lbl>Cabecera</Lbl><Inp value={p.cocinaCabecera} onChange={(e) => update({ cocinaCabecera: e.target.value })} /></div>
              <div><Lbl>Separador</Lbl>
                <select value={p.cocinaSeparador} onChange={(e) => update({ cocinaSeparador: e.target.value as Plantilla["cocinaSeparador"] })}
                  className="w-full rounded-xl border border-border bg-background p-3">
                  <option value="guiones">--------</option>
                  <option value="iguales">========</option>
                  <option value="puntos">········</option>
                  <option value="ninguno">Ninguno</option>
                </select>
              </div>
              <div><Lbl>Tamaño fuente</Lbl>
                <select value={p.cocinaTamFuente} onChange={(e) => update({ cocinaTamFuente: e.target.value as Plantilla["cocinaTamFuente"] })}
                  className="w-full rounded-xl border border-border bg-background p-3">
                  <option value="normal">Normal</option>
                  <option value="grande">Grande</option>
                  <option value="muy-grande">Muy grande</option>
                </select>
              </div>
              <Toggle label="Mostrar nº de pedido" v={p.cocinaMostrarNumPedido} onChange={(v) => update({ cocinaMostrarNumPedido: v })} />
              <Toggle label="Mostrar tipo de pedido" v={p.cocinaMostrarTipo} onChange={(v) => update({ cocinaMostrarTipo: v })} />
            </>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase text-muted-foreground">Vista previa</div>
          <div className="rounded-xl border border-border bg-white p-4 overflow-auto" style={{ maxHeight: 600 }}>
            <div
              style={{
                width: a.papel === "58mm" ? "58mm" : "80mm",
                margin: "0 auto",
                background: "#fff",
                color: "#000",
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                lineHeight: 1.35,
                padding: "4mm",
              }}
              dangerouslySetInnerHTML={{ __html: `<style>.t-logo{display:block;margin:0 auto 2px;max-width:56mm;max-height:28mm;object-fit:contain}.t-title{font-size:16px;font-weight:900;text-align:center;letter-spacing:.05em;margin-bottom:4px}.t-sub{text-align:center;font-size:11px;margin-bottom:6px}.t-sep{text-align:center;font-size:10px;letter-spacing:1px;margin:4px 0;overflow:hidden;white-space:nowrap}.t-row{display:flex;justify-content:space-between;gap:8px}.t-total{font-size:14px;font-weight:900}.t-mod{padding-left:10px;font-size:10px}.t-foot{text-align:center;margin-top:8px;font-size:11px}.t-big{font-size:18px;font-weight:900;text-align:center;margin:6px 0}.t-qr{display:block;margin:8px auto 4px}</style>${previewHTML}` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button onClick={() => toast.success("✅ Plantilla guardada")} className="rounded-2xl bg-primary py-3 font-black text-primary-foreground active:scale-95">💾 Guardar</button>
        <button onClick={imprimirPrueba} className="rounded-2xl bg-secondary py-3 font-black text-secondary-foreground active:scale-95">🖨️ Imprimir prueba</button>
        <button onClick={reset} className="rounded-2xl bg-destructive/10 py-3 font-black text-destructive active:scale-95">↩ Restablecer</button>
      </div>
    </div>
  );
}
