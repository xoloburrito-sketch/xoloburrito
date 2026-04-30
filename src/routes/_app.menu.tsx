import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur } from "@/lib/format";
import { Plus, Trash2, Pencil, X, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/menu")({
  component: MenuPage,
});

type Categoria = { id: string; nombre: string };
type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  precio: number;
  ingredientes: string[];
  activo: boolean;
};
type Extra = { id: string; nombre: string; precio: number; activo: boolean };

function MenuPage() {
  const [tab, setTab] = useState<"productos" | "extras" | "categorias">("productos");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [editProducto, setEditProducto] = useState<Producto | "nuevo" | null>(null);
  const [editExtra, setEditExtra] = useState<Extra | "nuevo" | null>(null);
  const [editCat, setEditCat] = useState<Categoria | "nuevo" | null>(null);

  const cargar = async () => {
    const [c, p, e] = await Promise.all([
      supabase.from("categorias").select("*").order("orden"),
      supabase.from("productos").select("*").order("orden"),
      supabase.from("extras").select("*").order("nombre"),
    ]);
    setCategorias((c.data as Categoria[]) || []);
    setProductos(((p.data || []) as unknown) as Producto[]);
    setExtras((e.data as Extra[]) || []);
  };
  useEffect(() => { cargar(); }, []);

  return (
    <div className="flex h-full flex-col p-3">
      <h1 className="pb-3 text-2xl font-black">Menú</h1>
      <div className="mb-3 flex gap-2">
        {(["productos","extras","categorias"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold capitalize active:scale-95 ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "productos" && (
        <>
          <button onClick={() => setEditProducto("nuevo")}
            className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-95">
            <Plus className="h-5 w-5" /> Nuevo producto
          </button>
          <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto pb-3 sm:grid-cols-2 xl:grid-cols-3">
            {productos.map((p) => {
              const cat = categorias.find((c) => c.id === p.categoria_id);
              return (
                <div key={p.id} className={`rounded-2xl bg-card p-4 shadow-sm ${!p.activo ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs uppercase text-muted-foreground">{cat?.nombre}</div>
                      <div className="text-lg font-black">{p.nombre}</div>
                      <div className="text-2xl font-black text-primary">{eur(p.precio)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{p.ingredientes.length} ingredientes</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={async () => {
                        await supabase.from("productos").update({ activo: !p.activo }).eq("id", p.id);
                        cargar();
                      }} className="rounded-lg p-2 hover:bg-muted"><Power className="h-4 w-4" /></button>
                      <button onClick={() => setEditProducto(p)} className="rounded-lg p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button onClick={async () => {
                        if (!confirm("¿Eliminar?")) return;
                        await supabase.from("productos").delete().eq("id", p.id);
                        cargar();
                      }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "extras" && (
        <>
          <button onClick={() => setEditExtra("nuevo")}
            className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-95">
            <Plus className="h-5 w-5" /> Nuevo extra
          </button>
          <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto pb-3 sm:grid-cols-2 xl:grid-cols-3">
            {extras.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
                <div>
                  <div className="font-bold">{e.nombre}</div>
                  <div className="text-primary font-black">{e.precio > 0 ? `+${eur(e.precio)}` : "Gratis"}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditExtra(e)} className="rounded-lg p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={async () => {
                    if (!confirm("¿Eliminar?")) return;
                    await supabase.from("extras").delete().eq("id", e.id);
                    cargar();
                  }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "categorias" && (
        <>
          <button onClick={() => setEditCat("nuevo")}
            className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-95">
            <Plus className="h-5 w-5" /> Nueva categoría
          </button>
          <div className="space-y-2 overflow-y-auto pb-3">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
                <div className="font-bold">{c.nombre}</div>
                <div className="flex gap-1">
                  <button onClick={() => setEditCat(c)} className="rounded-lg p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={async () => {
                    if (!confirm("¿Eliminar?")) return;
                    await supabase.from("categorias").delete().eq("id", c.id);
                    cargar();
                  }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editProducto && (
        <ProductoForm
          producto={editProducto === "nuevo" ? null : editProducto}
          categorias={categorias}
          onClose={() => setEditProducto(null)}
          onSaved={() => { cargar(); setEditProducto(null); }}
        />
      )}
      {editExtra && (
        <ExtraForm
          extra={editExtra === "nuevo" ? null : editExtra}
          onClose={() => setEditExtra(null)}
          onSaved={() => { cargar(); setEditExtra(null); }}
        />
      )}
      {editCat && (
        <CategoriaForm
          categoria={editCat === "nuevo" ? null : editCat}
          onClose={() => setEditCat(null)}
          onSaved={() => { cargar(); setEditCat(null); }}
        />
      )}
    </div>
  );
}

function ProductoForm({ producto, categorias, onClose, onSaved }: {
  producto: Producto | null; categorias: Categoria[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState({
    nombre: producto?.nombre ?? "",
    precio: producto?.precio?.toString() ?? "",
    categoria_id: producto?.categoria_id ?? categorias[0]?.id ?? "",
    ingredientes: producto?.ingredientes ?? [],
  });
  const [nuevoIng, setNuevoIng] = useState("");

  const guardar = async () => {
    const payload = {
      nombre: f.nombre.trim(),
      precio: parseFloat(f.precio.replace(",", ".")) || 0,
      categoria_id: f.categoria_id || null,
      ingredientes: f.ingredientes,
    };
    if (!payload.nombre) { toast.error("Nombre obligatorio"); return; }
    const { error } = producto
      ? await supabase.from("productos").update(payload).eq("id", producto.id)
      : await supabase.from("productos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-2xl font-black">{producto ? "Editar" : "Nuevo"} producto</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
            placeholder="Nombre" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <input value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })}
            inputMode="decimal" placeholder="Precio (€)" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <select value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}
            className="w-full rounded-xl border border-border bg-background p-4 text-lg">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div>
            <label className="mb-2 block text-sm font-bold">Ingredientes</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {f.ingredientes.map((ing, idx) => (
                <span key={idx} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  {ing}
                  <button onClick={() => setF({ ...f, ingredientes: f.ingredientes.filter((_, i) => i !== idx) })}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={nuevoIng} onChange={(e) => setNuevoIng(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && nuevoIng.trim()) { setF({ ...f, ingredientes: [...f.ingredientes, nuevoIng.trim()] }); setNuevoIng(""); }}}
                placeholder="Ej: 50gr Guacamole" className="flex-1 rounded-xl border border-border bg-background p-3" />
              <button onClick={() => { if (nuevoIng.trim()) { setF({ ...f, ingredientes: [...f.ingredientes, nuevoIng.trim()] }); setNuevoIng(""); }}}
                className="rounded-xl bg-primary px-4 font-bold text-primary-foreground active:scale-95">+</button>
            </div>
          </div>
        </div>
        <div className="border-t border-border p-4">
          <button onClick={guardar} className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-primary-foreground active:scale-95">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtraForm({ extra, onClose, onSaved }: { extra: Extra | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ nombre: extra?.nombre ?? "", precio: extra?.precio?.toString() ?? "0" });
  const guardar = async () => {
    if (!f.nombre.trim()) { toast.error("Nombre obligatorio"); return; }
    const payload = { nombre: f.nombre.trim(), precio: parseFloat(f.precio.replace(",", ".")) || 0 };
    const { error } = extra
      ? await supabase.from("extras").update(payload).eq("id", extra.id)
      : await supabase.from("extras").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-2xl font-black">{extra ? "Editar" : "Nuevo"} extra</h2>
        <div className="space-y-3">
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
            placeholder="Nombre" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <input value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })}
            inputMode="decimal" placeholder="Precio" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
          <button onClick={guardar} className="w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground active:scale-95">Guardar</button>
        </div>
      </div>
    </div>
  );
}

function CategoriaForm({ categoria, onClose, onSaved }: { categoria: Categoria | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const guardar = async () => {
    if (!nombre.trim()) return;
    const { error } = categoria
      ? await supabase.from("categorias").update({ nombre: nombre.trim() }).eq("id", categoria.id)
      : await supabase.from("categorias").insert({ nombre: nombre.trim() });
    if (error) { toast.error(error.message); return; }
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-2xl font-black">{categoria ? "Editar" : "Nueva"} categoría</h2>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre" className="w-full rounded-xl border border-border bg-background p-4 text-lg" />
        <button onClick={guardar} className="mt-3 w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground active:scale-95">Guardar</button>
      </div>
    </div>
  );
}
