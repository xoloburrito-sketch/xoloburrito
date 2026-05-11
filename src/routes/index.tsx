import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { obtenerPin, autenticar, estaAutenticado } from "@/lib/pin";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POS Burritos — Acceso" },
      { name: "description", content: "Punto de venta para tu negocio de burritos." },
    ],
  }),
  component: PinPage,
});

function PinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (estaAutenticado()) navigate({ to: "/caja" });
  }, [navigate]);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === obtenerPin()) {
        autenticar();
        navigate({ to: "/caja" });
      } else {
        setError(true);
        setTimeout(() => { setPin(""); setError(false); }, 600);
      }
    }
  }, [pin, navigate]);

  const tap = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4 text-secondary-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white p-2 shadow-2xl">
          <img src="/xolo-logo.jpeg" alt="Xölo Burritos" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">XÖLO BURRITOS</h1>
        <p className="mt-2 text-sm text-secondary-foreground/60">Introduce tu PIN para entrar</p>

        <div className={`my-8 flex justify-center gap-3 ${error ? "animate-pulse" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition ${
                error ? "border-destructive bg-destructive"
                  : pin.length > i ? "border-primary bg-primary" : "border-secondary-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => tap(d)}
              className="rounded-2xl bg-sidebar-accent py-5 text-3xl font-bold text-secondary-foreground transition active:scale-95 active:bg-primary active:text-primary-foreground"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => tap("0")}
            className="rounded-2xl bg-sidebar-accent py-5 text-3xl font-bold text-secondary-foreground transition active:scale-95 active:bg-primary active:text-primary-foreground"
          >
            0
          </button>
          <button
            onClick={back}
            className="flex items-center justify-center rounded-2xl bg-sidebar-accent py-5 text-secondary-foreground transition active:scale-95 active:bg-destructive"
          >
            <Delete className="h-7 w-7" />
          </button>
        </div>

        <p className="mt-6 text-xs text-secondary-foreground/40">
          PIN por defecto: <span className="font-mono font-bold">1234</span> · Cámbialo en Ajustes
        </p>
      </div>
    </div>
  );
}
