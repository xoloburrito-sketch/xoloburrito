import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fechaCorta } from "@/lib/format";
import { Search, UserPlus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
});

type Cliente = {
  id: string;
  telefono: string;
  nombre: string;
  direccion: string | null;
  notas: string | null;
  created_at: string;
};

function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [edit, setEdit] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    const { data } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    setClientes((data as Cliente[]) || []);
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.telefono.includes(busqueda)
  );

  const eliminar = async (c: Cliente) => {
    if (!confirm(`¿Eliminar a ${c.nombre}?`)) return;
    await supabase.from("clientes").delete().eq("id", c.id);
    toast.success("Cliente eliminado");
    cargar();
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h1 className="text-2xl font-black">Clientes</h1>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow active:scale-95"
        >
          <UserPlus className="h-5 w-5" /> Nuevo
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-base"
        />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto pb-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtrados.map((c) => (
          <div key={c.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <div className="text-lg font-black">{c.nombre}</div>
                <div className="text-sm text-muted-foreground">📞 {c.telefono}</div>
                {c.direccion && <div className="text-xs text-muted-foreground">📍 {c.direccion}</div>}
                <div className="mt-2 text-xs text-muted-foreground">Cliente desde {fechaCorta(c.created_at)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEdit(c)} className="rounded-lg p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => eliminar(c)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground">Sin clientes</div>
        )}
      </div>

      {(edit || creando) && (
        <ClienteFormDialog
          cliente={edit}
          onClose={() => { setEdit(null); setCreando(false); }}
          onSaved={() => { cargar(); setEdit(null); setCreando(false); }}
        />
      )}
    </div>
  );
}

function ClienteFormDialog({
  cliente, onClose, onSaved,
}: { cliente: Cliente | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    telefono: cliente?.telefono ?? "",
    nombre: cliente?.nombre ?? "",
    direccion: cliente?.direccion ?? "",
    notas: cliente?.notas ?? "",
  });
  const guardar = async () => {
    if (!f.telefono.trim() || !f.nombre.trim()) { toast.error("Teléfono y nombre obligatorios"); return; }
    const payload = {
      telefono: f.telefono.trim(),
      nombre: f.nombre.trim(),
      direccion: f.direccion.trim() || null,
      notas: f.notas.trim() || null,
    };
    const { error } = cliente
      ? await supabase.from("clientes").update(payload).eq("id", cliente.id)
      : await supabase.from("clientes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">{cliente ? "Editar" : "Nuevo"} cliente</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })}
            placeholder="Teléfono *" inputMode="tel" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
            placeholder="Nombre *" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <textarea value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })}
            placeholder="Dirección" rows={2} className="w-full rounded-xl border border-border bg-background p-4" />
          <textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })}
            placeholder="Notas (alergias, preferencias…)" rows={2} className="w-full rounded-xl border border-border bg-background p-4" />
          <button onClick={guardar} className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-primary-foreground active:scale-95">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
