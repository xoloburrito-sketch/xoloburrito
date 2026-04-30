import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { obtenerPin, cambiarPin } from "@/lib/pin";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ajustes")({
  component: AjustesPage,
});

function AjustesPage() {
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [conf, setConf] = useState("");

  const guardar = () => {
    if (actual !== obtenerPin()) { toast.error("PIN actual incorrecto"); return; }
    if (!/^\d{4}$/.test(nuevo)) { toast.error("El PIN debe tener 4 dígitos"); return; }
    if (nuevo !== conf) { toast.error("Los PIN no coinciden"); return; }
    cambiarPin(nuevo);
    setActual(""); setNuevo(""); setConf("");
    toast.success("PIN actualizado");
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-black">Ajustes</h1>
      <div className="rounded-3xl bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Cambiar PIN de acceso</h2>
        <div className="space-y-3">
          <input value={actual} onChange={(e) => setActual(e.target.value)}
            inputMode="numeric" maxLength={4} placeholder="PIN actual"
            className="w-full rounded-xl border border-border bg-background p-4 text-center text-2xl tracking-widest" />
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)}
            inputMode="numeric" maxLength={4} placeholder="PIN nuevo (4 dígitos)"
            className="w-full rounded-xl border border-border bg-background p-4 text-center text-2xl tracking-widest" />
          <input value={conf} onChange={(e) => setConf(e.target.value)}
            inputMode="numeric" maxLength={4} placeholder="Confirmar PIN nuevo"
            className="w-full rounded-xl border border-border bg-background p-4 text-center text-2xl tracking-widest" />
          <button onClick={guardar} className="w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground active:scale-95">
            Actualizar PIN
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold">Sobre el POS</h2>
        <p className="text-sm text-muted-foreground">
          Punto de venta para uso interno. Los datos (clientes, pedidos, menú) se guardan
          en la nube y se sincronizan entre dispositivos. PIN por defecto: <b>1234</b>.
        </p>
      </div>
    </div>
  );
}
