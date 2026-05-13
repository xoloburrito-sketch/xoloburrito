// Helpers de impresión POS80 reutilizables
import { eur } from "./format";
import { getAjustes } from "./ajustes";
import { getPlantilla, separadorChars, tamCocinaPx, type Plantilla } from "./plantilla";
import { impresorasParaRol } from "./impresoras";

export const TICKET_CSS = `
@page { size: 80mm auto; margin: 0; }
html,body{margin:0;padding:0;background:#fff;color:#000}
body{font-family:'Consolas','Lucida Console','Courier New',monospace;font-size:13px;font-weight:600;line-height:1.35;width:72mm;padding:3mm 4mm;letter-spacing:.01em;color:#000}
.t-logo{display:block;margin:0 auto 2px;max-width:56mm;max-height:28mm;object-fit:contain}
.t-title{font-size:18px;font-weight:900;text-align:center;letter-spacing:.05em;margin-bottom:4px}
.t-sub{text-align:center;font-size:12px;margin-bottom:6px}
.t-sep{text-align:center;font-size:11px;letter-spacing:1px;margin:4px 0;overflow:hidden;white-space:nowrap}
.t-row{display:flex;justify-content:space-between;gap:8px}
.t-total{font-size:16px;font-weight:900}
.t-mod{padding-left:10px;font-size:11px}
.t-foot{text-align:center;margin-top:10px;font-size:12px}
.t-big{font-size:20px;font-weight:900;text-align:center;margin:6px 0}
.t-qr{display:block;margin:8px auto 4px}
`;

export function printHTML(innerHtml: string, title = "Ticket") {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${TICKET_CSS}</style></head><body>${innerHtml}</body></html>`;
  try {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return false; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error(e); }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 2000);
    }, 300);
    return true;
  } catch (e) {
    console.error("printHTML", e);
    return false;
  }
}

const COPIAS_CSS = `
.copia { page-break-after: always; }
.copia:last-child { page-break-after: auto; }
.copia-h { text-align:center; font-weight:900; font-size:14px; margin:0 0 6px 0; padding:4px 0; border-top:2px solid #000; border-bottom:2px solid #000; letter-spacing:.06em; }
.copia.cocina { font-size:16px; }
.copia.cocina .t-mod { font-size:14px; }
@media print { .copia { page-break-after: always; } .copia:last-child { page-break-after: auto; } }
`;

/** Trata de enviar a impresoras LAN configuradas por rol. Devuelve nº de jobs enviados. */
async function enviarLAN(rol: "cliente" | "cocina" | "negocio", html: string): Promise<number> {
  const lista = impresorasParaRol(rol).filter((p) => p.tipo === "lan" && p.ip);
  let n = 0;
  for (const p of lista) {
    try {
      await fetch(`http://${p.ip}:${p.puerto || 9100}/`, {
        method: "POST",
        mode: "no-cors",
        body: html,
        signal: AbortSignal.timeout(2500),
      });
      n++;
    } catch (e) {
      console.warn("LAN print falló", p.nombre, e);
    }
  }
  return n;
}

/** Imprime un HTML por el sistema en un iframe oculto. Devuelve una promesa que resuelve cuando se ha llamado a print(). */
function printSystem(innerBody: string, title: string, delay = 350): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${TICKET_CSS}${COPIAS_CSS}</style></head><body>${innerBody}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { document.body.removeChild(iframe); resolve(false); return; }
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) { console.error("print error", e); resolve(false); }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 3000);
      }, delay);
    } catch (e) {
      console.error("printSystem", e);
      resolve(false);
    }
  });
}

/**
 * Imprime las 3 copias en DOS trabajos separados para poder elegir impresoras distintas:
 *  - Trabajo 1: Cliente + Negocio (→ p.ej. AvPos T40TC)
 *  - Trabajo 2: Comanda cocina (→ p.ej. Qian 80 QOP-T80BL-RI)
 * Cada trabajo abre su propio diálogo de impresión, así puedes seleccionar
 * una impresora distinta como predeterminada en cada uno.
 *
 * Si hay impresoras LAN configuradas, se envían por red en paralelo
 * y se omite del sistema la copia que ya se mandó por LAN.
 */
export async function printTicket3Copias(opts: { ticketInner: string; comandaInner: string; title?: string }) {
  // 1) Envío por LAN según roles configurados (no bloquea)
  const [nCli, nNeg, nCoc] = await Promise.all([
    enviarLAN("cliente", opts.ticketInner).catch(() => 0),
    enviarLAN("negocio", opts.ticketInner).catch(() => 0),
    enviarLAN("cocina", opts.comandaInner).catch(() => 0),
  ]);

  // 2) Fallback por sistema: las 3 copias en UN único trabajo de impresión
  const partes: string[] = [];
  if (nCli === 0) partes.push(`<div class="copia"><div class="copia-h">COPIA CLIENTE</div>${opts.ticketInner}</div>`);
  if (nNeg === 0) partes.push(`<div class="copia"><div class="copia-h">COPIA NEGOCIO</div>${opts.ticketInner}</div>`);
  if (nCoc === 0) partes.push(`<div class="copia cocina"><div class="copia-h">📋 COMANDA COCINA</div>${opts.comandaInner}</div>`);

  if (partes.length === 0) return true; // todo enviado por LAN
  return await printSystem(partes.join(""), opts.title || "Ticket", 300);
}

type Mod = { quitar?: string[]; extras?: { nombre: string; precio: number }[]; notas?: string };
type ItemTicket = { nombre: string; cantidad: number; precio_unitario: number; modificaciones?: Mod };
type PedidoTicket = {
  numero: number;
  created_at: string;
  tipo: string;
  metodo_pago?: string | null;
  subtotal: number;
  envio: number;
  descuento?: number;
  total: number;
  recibido?: number | null;
  cambio?: number | null;
  cliente?: { nombre: string; telefono: string; direccion?: string | null; piso?: string | null; codigo_puerta?: string | null; nota_reparto?: string | null } | null;
  notas?: string | null;
  turno?: string | null;
};

const tipoLabel = (t: string) =>
  t === "local" ? "LOCAL"
  : t === "domicilio" ? "DOMICILIO"
  : t === "glovo" ? "GLOVO"
  : t === "just_eat" ? "JUST EAT"
  : t === "uber_eats" ? "UBER EATS"
  : t.toUpperCase();

const lineaTotal = (i: ItemTicket) => {
  const ex = (i.modificaciones?.extras || []).reduce((s, e) => s + Number(e.precio), 0);
  return (Number(i.precio_unitario) + ex) * i.cantidad;
};

function logoTag(p: Plantilla) {
  const a = getAjustes();
  if (!p.mostrarLogo) return "";
  const src = a.logoBase64 || `${typeof window !== "undefined" ? window.location.origin : ""}/xolo-logo.jpeg`;
  return `<img class="t-logo" src="${src}" alt="logo" />`;
}

function sepTag(t: Plantilla["separador"]) {
  const c = separadorChars(t);
  return c ? `<div class="t-sep">${c}</div>` : "";
}

function negocioLines(p: Plantilla) {
  const parts = [p.direccion, p.telefono, p.cif ? `CIF: ${p.cif}` : ""].filter(Boolean);
  return parts.length ? `<div class="t-sub">${parts.join(" · ")}</div>` : "";
}

function fmtCantidad(p: Plantilla, cantidad: number, nombre: string) {
  return p.formatoCantidad === "despues" ? `${nombre} x${cantidad}` : `${cantidad}x ${nombre}`;
}

export function ticketHTML(pedido: PedidoTicket, items: ItemTicket[]) {
  const p = getPlantilla();
  const a = getAjustes();
  const ivaPct = a.iva || 0;
  const baseImponible = ivaPct > 0 ? pedido.total / (1 + ivaPct / 100) : pedido.total;
  const ivaImporte = pedido.total - baseImponible;
  return `
${logoTag(p)}
<div class="t-title">${p.nombreNegocio || a.ticketHeader}</div>
${negocioLines(p)}
${p.textoCabecera ? `<div class="t-sub">${p.textoCabecera.replace(/\n/g, "<br/>")}</div>` : ""}
${(p.mostrarNumPedido || p.mostrarFechaHora) ? `<div class="t-sub">${p.mostrarNumPedido ? `Pedido #${pedido.numero}` : ""}${p.mostrarNumPedido && p.mostrarFechaHora ? "<br/>" : ""}${p.mostrarFechaHora ? new Date(pedido.created_at).toLocaleString("es-ES") : ""}</div>` : ""}
${p.mostrarTurno && pedido.turno ? `<div class="t-sub">Turno: ${pedido.turno}</div>` : ""}
${sepTag(p.separador)}
<div style="font-weight:800">** ${tipoLabel(pedido.tipo)} **</div>
${pedido.cliente ? `<div style="margin-top:4px">
  Cliente: ${pedido.cliente.nombre}<br/>
  Tel: ${pedido.cliente.telefono}
  ${pedido.cliente.direccion ? `<br/>Dir: ${pedido.cliente.direccion}` : ""}
  ${pedido.cliente.piso ? `<br/>Piso: ${pedido.cliente.piso}` : ""}
  ${pedido.cliente.codigo_puerta ? `<br/>Cod: ${pedido.cliente.codigo_puerta}` : ""}
  ${pedido.cliente.nota_reparto ? `<br/>Nota: ${pedido.cliente.nota_reparto}` : ""}
</div>` : ""}
${sepTag(p.separador)}
${items.map((i) => `
  <div style="margin-bottom:6px">
    <div class="t-row"><span>${fmtCantidad(p, i.cantidad, i.nombre)}</span><span>${eur(lineaTotal(i))}</span></div>
    ${p.mostrarPrecioUnit ? `<div class="t-mod">u: ${eur(Number(i.precio_unitario))}</div>` : ""}
    ${(i.modificaciones?.quitar || []).map((q) => `<div class="t-mod">- sin ${q}</div>`).join("")}
    ${(i.modificaciones?.extras || []).map((e) => `<div class="t-mod">+ ${e.nombre} ${e.precio > 0 ? eur(e.precio) : ""}</div>`).join("")}
    ${i.modificaciones?.notas ? `<div class="t-mod" style="font-style:italic">* ${i.modificaciones.notas}</div>` : ""}
  </div>
`).join("")}
${sepTag(p.separador)}
<div class="t-row"><span>Subtotal</span><span>${eur(pedido.subtotal)}</span></div>
${Number(pedido.envio || 0) > 0 ? `<div class="t-row"><span>Envío</span><span>${eur(pedido.envio)}</span></div>` : ""}
${Number(pedido.descuento || 0) > 0 ? `<div class="t-row"><span>Descuento</span><span>-${eur(Number(pedido.descuento))}</span></div>` : ""}
<div class="t-row t-total"><span>TOTAL</span><span>${eur(pedido.total)}</span></div>
${p.mostrarIVA ? `<div class="t-row" style="font-size:11px"><span>Base (${ivaPct}%)</span><span>${eur(baseImponible)}</span></div><div class="t-row" style="font-size:11px"><span>IVA</span><span>${eur(ivaImporte)}</span></div>` : ""}
${pedido.metodo_pago ? `<div class="t-row"><span>Pago (${pedido.metodo_pago})</span><span>${eur(pedido.recibido ?? pedido.total)}</span></div>` : ""}
${pedido.metodo_pago === "efectivo" && pedido.cambio != null ? `<div class="t-row"><span>Cambio</span><span>${eur(pedido.cambio)}</span></div>` : ""}
${pedido.notas ? `${sepTag(p.separador)}<div>Notas: ${pedido.notas}</div>` : ""}
${p.pie1 ? `<div class="t-foot">${p.pie1}</div>` : ""}
${p.pie2 ? `<div class="t-foot">${p.pie2}</div>` : ""}
${p.mostrarQR && p.qrUrl ? `<img class="t-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(p.qrUrl)}" alt="QR" width="120" height="120" />${p.qrTexto ? `<div class="t-foot">${p.qrTexto}</div>` : ""}` : ""}
`;
}

export function comandaCocinaHTML(pedido: { numero: number; tipo: string; created_at: string }, items: ItemTicket[]) {
  const p = getPlantilla();
  const fz = tamCocinaPx(p.cocinaTamFuente);
  return `
<div class="t-title">${p.cocinaCabecera || "COCINA"}</div>
${p.cocinaMostrarNumPedido ? `<div class="t-big">#${pedido.numero}</div>` : ""}
<div class="t-sub">${new Date(pedido.created_at).toLocaleTimeString("es-ES")}${p.cocinaMostrarTipo ? ` · ${tipoLabel(pedido.tipo)}` : ""}</div>
${sepTag(p.cocinaSeparador)}
${items.map((i) => `
  <div style="margin-bottom:6px;font-size:${fz}px">
    <div style="font-weight:900">${fmtCantidad(p, i.cantidad, i.nombre)}</div>
    ${(i.modificaciones?.quitar || []).map((q) => `<div class="t-mod" style="font-size:${fz - 2}px">- SIN ${q.toUpperCase()}</div>`).join("")}
    ${(i.modificaciones?.extras || []).map((e) => `<div class="t-mod" style="font-size:${fz - 2}px">+ ${e.nombre.toUpperCase()}</div>`).join("")}
    ${i.modificaciones?.notas ? `<div class="t-mod" style="font-size:${fz - 2}px;font-weight:800">>> ${i.modificaciones.notas}</div>` : ""}
  </div>
`).join("")}
${sepTag(p.cocinaSeparador)}
`;
}

export type CierreData = {
  fecha: string;
  efectivo: number;
  tarjeta: number;
  glovo: number;
  just_eat: number;
  uber_eats: number;
  envios: number;
  descuentos: number;
  ajustes: number;
  anulados: number;
  anuladosN: number;
  local: number;
  domicilio: number;
  recoger: number;
  total: number;
  pedidos: number;
  cajaTeorica: number;
};

export function cierreHTML(c: CierreData) {
  const p = getPlantilla();
  const a = getAjustes();
  return `
${logoTag(p)}
<div class="t-title">${p.nombreNegocio || a.ticketHeader}</div>
${negocioLines(p)}
<div class="t-sub">CIERRE DE JORNADA<br/>${c.fecha} · ${new Date().toLocaleTimeString("es-ES")}</div>
${sepTag(p.separador)}
<div class="t-row"><span>Ventas efectivo</span><span>${eur(c.efectivo)}</span></div>
<div class="t-row"><span>Ventas tarjeta</span><span>${eur(c.tarjeta)}</span></div>
<div class="t-row"><span>Ventas Glovo</span><span>${eur(c.glovo)}</span></div>
<div class="t-row"><span>Ventas Just Eat</span><span>${eur(c.just_eat)}</span></div>
<div class="t-row"><span>Ventas Uber Eats</span><span>${eur(c.uber_eats)}</span></div>
${sepTag(p.separador)}
<div class="t-row"><span>Local</span><span>${eur(c.local)}</span></div>
<div class="t-row"><span>Domicilio</span><span>${eur(c.domicilio)}</span></div>
<div class="t-row"><span>Envíos cobrados</span><span>${eur(c.envios)}</span></div>
<div class="t-row"><span>Descuentos</span><span>-${eur(c.descuentos)}</span></div>
<div class="t-row"><span>Ajustes</span><span>${c.ajustes >= 0 ? "+" : ""}${eur(c.ajustes)}</span></div>
<div class="t-row"><span>Anulados (${c.anuladosN})</span><span>-${eur(c.anulados)}</span></div>
${sepTag(p.separador)}
<div class="t-row"><span>Pedidos del día</span><span>${c.pedidos}</span></div>
<div class="t-row t-total"><span>TOTAL VENTAS</span><span>${eur(c.total)}</span></div>
${sepTag(p.separador)}
<div class="t-big">CAJA: ${eur(c.cajaTeorica)}</div>
<div class="t-sub">(efectivo + ajustes)</div>
<div class="t-foot">Firma: _____________________</div>
`;
}
