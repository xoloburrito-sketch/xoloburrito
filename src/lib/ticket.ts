// Helpers de impresión POS80 reutilizables
import { eur } from "./format";
import { getAjustes } from "./ajustes";

export const TICKET_CSS = `
@page { size: 80mm auto; margin: 0; }
html,body{margin:0;padding:0;background:#fff;color:#000}
body{font-family:'Consolas','Lucida Console','Courier New',monospace;font-size:13px;font-weight:600;line-height:1.35;width:72mm;padding:3mm 4mm;letter-spacing:.01em;color:#000}
.t-logo{display:block;margin:0 auto 2px;max-width:56mm;max-height:28mm;object-fit:contain}
.t-title{font-size:18px;font-weight:900;text-align:center;letter-spacing:.05em;margin-bottom:4px}
.t-sub{text-align:center;font-size:12px;margin-bottom:6px}
.t-sep{text-align:center;font-size:11px;letter-spacing:1px;margin:4px 0;overflow:hidden;white-space:nowrap}
.t-sep::before{content:"========================================"}
.t-row{display:flex;justify-content:space-between;gap:8px}
.t-total{font-size:16px;font-weight:900}
.t-mod{padding-left:10px;font-size:11px}
.t-foot{text-align:center;margin-top:10px;font-size:12px}
.t-big{font-size:20px;font-weight:900;text-align:center;margin:6px 0}
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

/** Imprime 3 copias automáticas en una sola llamada: Cliente, Negocio, Cocina. */
export function printTicket3Copias(opts: { ticketInner: string; comandaInner: string; title?: string }) {
  const body = `
    <div class="copia"><div class="copia-h">COPIA CLIENTE</div>${opts.ticketInner}</div>
    <div class="copia"><div class="copia-h">COPIA NEGOCIO</div>${opts.ticketInner}</div>
    <div class="copia cocina"><div class="copia-h">📋 COMANDA COCINA</div>${opts.comandaInner}</div>
  `;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${opts.title || "Ticket"}</title><style>${TICKET_CSS}${COPIAS_CSS}</style></head><body>${body}</body></html>`;
  try {
    // Usamos un iframe oculto: no lo bloquea el navegador como los pop-ups
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return false; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) { console.error("print error", e); }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 2000);
    }, 350);
    return true;
  } catch (e) {
    console.error("printTicket3Copias", e);
    return false;
  }
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

function logoTag() {
  const a = getAjustes();
  if (!a.mostrarLogo) return "";
  const src = a.logoBase64 || `${typeof window !== "undefined" ? window.location.origin : ""}/xolo-logo.jpeg`;
  return `<img class="t-logo" src="${src}" alt="logo" />`;
}

function negocioLines() {
  const a = getAjustes();
  const parts = [a.direccionNegocio, a.telefonoNegocio, a.cifNegocio ? `CIF: ${a.cifNegocio}` : ""].filter(Boolean);
  return parts.length ? `<div class="t-sub">${parts.join(" · ")}</div>` : "";
}

export function ticketHTML(p: PedidoTicket, items: ItemTicket[]) {
  const a = getAjustes();
  return `
${logoTag()}
<div class="t-title">${a.ticketHeader}</div>
${negocioLines()}
<div class="t-sub">Pedido #${p.numero}<br/>${new Date(p.created_at).toLocaleString("es-ES")}</div>
<div class="t-sep"></div>
<div style="font-weight:800">** ${tipoLabel(p.tipo)} **</div>
${p.cliente ? `<div style="margin-top:4px">
  Cliente: ${p.cliente.nombre}<br/>
  Tel: ${p.cliente.telefono}
  ${p.cliente.direccion ? `<br/>Dir: ${p.cliente.direccion}` : ""}
  ${p.cliente.piso ? `<br/>Piso: ${p.cliente.piso}` : ""}
  ${p.cliente.codigo_puerta ? `<br/>Cod: ${p.cliente.codigo_puerta}` : ""}
  ${p.cliente.nota_reparto ? `<br/>Nota: ${p.cliente.nota_reparto}` : ""}
</div>` : ""}
<div class="t-sep"></div>
${items.map((i) => `
  <div style="margin-bottom:6px">
    <div class="t-row"><span>${i.cantidad}x ${i.nombre}</span><span>${eur(lineaTotal(i))}</span></div>
    ${(i.modificaciones?.quitar || []).map((q) => `<div class="t-mod">- sin ${q}</div>`).join("")}
    ${(i.modificaciones?.extras || []).map((e) => `<div class="t-mod">+ ${e.nombre} ${e.precio > 0 ? eur(e.precio) : ""}</div>`).join("")}
    ${i.modificaciones?.notas ? `<div class="t-mod" style="font-style:italic">* ${i.modificaciones.notas}</div>` : ""}
  </div>
`).join("")}
<div class="t-sep"></div>
<div class="t-row"><span>Subtotal</span><span>${eur(p.subtotal)}</span></div>
${Number(p.envio || 0) > 0 ? `<div class="t-row"><span>Envío</span><span>${eur(p.envio)}</span></div>` : ""}
${Number(p.descuento || 0) > 0 ? `<div class="t-row"><span>Descuento</span><span>-${eur(Number(p.descuento))}</span></div>` : ""}
<div class="t-row t-total"><span>TOTAL</span><span>${eur(p.total)}</span></div>
${p.metodo_pago ? `<div class="t-row"><span>Pago (${p.metodo_pago})</span><span>${eur(p.recibido ?? p.total)}</span></div>` : ""}
${p.metodo_pago === "efectivo" && p.cambio != null ? `<div class="t-row"><span>Cambio</span><span>${eur(p.cambio)}</span></div>` : ""}
${p.notas ? `<div class="t-sep"></div><div>Notas: ${p.notas}</div>` : ""}
<div class="t-foot">${getAjustes().ticketFooter}</div>
`;
}

export function comandaCocinaHTML(p: { numero: number; tipo: string; created_at: string }, items: ItemTicket[]) {
  return `
${logoTag()}
<div class="t-big">#${p.numero}</div>
<div class="t-sub">${new Date(p.created_at).toLocaleTimeString("es-ES")} · ${tipoLabel(p.tipo)}</div>
<div class="t-sep"></div>
${items.map((i) => `
  <div style="margin-bottom:6px;font-size:14px">
    <div style="font-weight:900">${i.cantidad}x ${i.nombre}</div>
    ${(i.modificaciones?.quitar || []).map((q) => `<div class="t-mod">- SIN ${q.toUpperCase()}</div>`).join("")}
    ${(i.modificaciones?.extras || []).map((e) => `<div class="t-mod">+ ${e.nombre.toUpperCase()}</div>`).join("")}
    ${i.modificaciones?.notas ? `<div class="t-mod" style="font-weight:800">>> ${i.modificaciones.notas}</div>` : ""}
  </div>
`).join("")}
<div class="t-sep"></div>
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
  const a = getAjustes();
  return `
${logoTag()}
<div class="t-title">${a.ticketHeader}</div>
${negocioLines()}
<div class="t-sub">CIERRE DE JORNADA<br/>${c.fecha} · ${new Date().toLocaleTimeString("es-ES")}</div>
<div class="t-sep"></div>
<div class="t-row"><span>Ventas efectivo</span><span>${eur(c.efectivo)}</span></div>
<div class="t-row"><span>Ventas tarjeta</span><span>${eur(c.tarjeta)}</span></div>
<div class="t-row"><span>Ventas Glovo</span><span>${eur(c.glovo)}</span></div>
<div class="t-row"><span>Ventas Just Eat</span><span>${eur(c.just_eat)}</span></div>
<div class="t-row"><span>Ventas Uber Eats</span><span>${eur(c.uber_eats)}</span></div>
<div class="t-sep"></div>
<div class="t-row"><span>Local</span><span>${eur(c.local)}</span></div>
<div class="t-row"><span>Domicilio</span><span>${eur(c.domicilio)}</span></div>
<div class="t-row"><span>Envíos cobrados</span><span>${eur(c.envios)}</span></div>
<div class="t-row"><span>Descuentos</span><span>-${eur(c.descuentos)}</span></div>
<div class="t-row"><span>Ajustes</span><span>${c.ajustes >= 0 ? "+" : ""}${eur(c.ajustes)}</span></div>
<div class="t-row"><span>Anulados (${c.anuladosN})</span><span>-${eur(c.anulados)}</span></div>
<div class="t-sep"></div>
<div class="t-row"><span>Pedidos del día</span><span>${c.pedidos}</span></div>
<div class="t-row t-total"><span>TOTAL VENTAS</span><span>${eur(c.total)}</span></div>
<div class="t-sep"></div>
<div class="t-big">CAJA: ${eur(c.cajaTeorica)}</div>
<div class="t-sub">(efectivo + ajustes)</div>
<div class="t-foot">Firma: _____________________</div>
`;
}
