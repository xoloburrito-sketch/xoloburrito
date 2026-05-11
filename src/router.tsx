import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  const limpiarYReiniciar = () => {
    try {
      // Conserva el PIN para que el usuario no pierda el acceso
      const pin = localStorage.getItem("pos_pin");
      const claves = ["pos_turno_activo", "pos_turnos_historial", "pos_ajustes_v1", "pos_carrito"];
      for (const k of claves) {
        try { localStorage.removeItem(k); } catch { /* noop */ }
      }
      if (pin) localStorage.setItem("pos_pin", pin);
    } catch { /* noop */ }
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se ha producido un error inesperado. Si el problema persiste, limpia la caché local y vuelve a intentarlo.
        </p>
        {error?.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
          <button
            onClick={limpiarYReiniciar}
            className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90"
          >
            🧹 Limpiar caché y reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
