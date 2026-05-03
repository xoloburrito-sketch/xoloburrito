import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Search, UserPlus } from "lucide-react";
import { carrito } from "@/lib/pos-store";
import { toast } from "sonner";

type Cliente = {
  id: string;
  telefono: string;
  nombre: string;
  direccion: string | null;
  piso?: string | null;
  codigo_puerta?: string | null;
  nota_reparto?: string | null;
};

export function ClienteDialog({ onClose }: { onClose: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [modo, setModo] = useState<"buscar" | "crear">("buscar");
  const [nuevo, setNuevo] = useState({
    telefono: "", nombre: "", direccion: "",
    piso: "", codigo_puerta: "", nota_reparto: "",
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busqueda.length < 1) { setResultados([]); return; }
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .or(`telefono.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`)
        .limit(20);
      setResultados((data as Cliente[]) || []);
    }, 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionar = (c: Cliente) => {
    carrito.setCliente(c);
    onClose();
  };

  const crear = async () => {
    if (!nuevo.telefono.trim() || !nuevo.nombre.trim()) {
      toast.error("Teléfono y nombre son obligatorios");
      return;
    }
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        telefono: nuevo.telefono.trim(),
        nombre: nuevo.nombre.trim(),
        direccion: nuevo.direccion.trim() || null,
        piso: nuevo.piso.trim() || null,
        codigo_puerta: nuevo.codigo_puerta.trim() || null,
        nota_reparto: nuevo.nota_reparto.trim() || null,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    seleccionar(data as Cliente);
    toast.success("Cliente añadido");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-2xl font-black">Cliente</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex gap-2 p-3">
          <button
            onClick={() => setModo("buscar")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${modo === "buscar" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <Search className="mr-2 inline h-4 w-4" /> Buscar
          </button>
          <button
            onClick={() => setModo("crear")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${modo === "crear" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <UserPlus className="mr-2 inline h-4 w-4" /> Nuevo
          </button>
        </div>

        {modo === "buscar" ? (
          <div className="flex-1 overflow-y-auto p-4">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Teléfono o nombre…"
              className="w-full rounded-xl border border-border bg-background p-4 text-lg"
            />
            <div className="mt-3 space-y-2">
              {resultados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => seleccionar(c)}
                  className="flex w-full items-center justify-between rounded-xl bg-muted p-4 text-left active:scale-95"
                >
                  <div>
                    <div className="font-bold">{c.nombre}</div>
                    <div className="text-sm text-muted-foreground">📞 {c.telefono}</div>
                    {c.direccion && <div className="text-xs text-muted-foreground">📍 {c.direccion}</div>}
                    {(c.piso || c.codigo_puerta) && (
                      <div className="text-xs text-muted-foreground">
                        {c.piso && `🏠 ${c.piso}`} {c.codigo_puerta && `🔑 ${c.codigo_puerta}`}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              {busqueda && resultados.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados — crea uno nuevo</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <Field label="Teléfono *" v={nuevo.telefono} onChange={(v) => setNuevo({ ...nuevo, telefono: v })} mode="tel" />
            <Field label="Nombre *" v={nuevo.nombre} onChange={(v) => setNuevo({ ...nuevo, nombre: v })} />
            <Field label="Dirección" v={nuevo.direccion} onChange={(v) => setNuevo({ ...nuevo, direccion: v })} multiline />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Piso / Puerta" v={nuevo.piso} onChange={(v) => setNuevo({ ...nuevo, piso: v })} />
              <Field label="Código portal" v={nuevo.codigo_puerta} onChange={(v) => setNuevo({ ...nuevo, codigo_puerta: v })} />
            </div>
            <Field label="Nota de reparto" v={nuevo.nota_reparto} onChange={(v) => setNuevo({ ...nuevo, nota_reparto: v })} multiline />
            <button
              onClick={crear}
              className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-primary-foreground active:scale-95"
            >
              Guardar y usar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, v, onChange, mode, multiline }: {
  label: string; v: string; onChange: (v: string) => void; mode?: "tel" | "text"; multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      {multiline ? (
        <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full rounded-xl border border-border bg-background p-3" />
      ) : (
        <input value={v} onChange={(e) => onChange(e.target.value)} inputMode={mode === "tel" ? "tel" : undefined}
          className="w-full rounded-xl border border-border bg-background p-3 text-lg" />
      )}
    </div>
  );
}
