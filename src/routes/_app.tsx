import { Link, Outlet, useLocation, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Users, ListOrdered, Settings, LogOut, UtensilsCrossed, Calculator } from "lucide-react";
import { estaAutenticado, cerrarSesion } from "@/lib/pin";
import { useTurnoActivo, turnoLabel } from "@/lib/turnos";
import { aplicarTema, getAjustes } from "@/lib/ajustes";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const nav = [
  { to: "/caja", label: "Caja", Icon: ShoppingCart },
  { to: "/pedidos", label: "Pedidos", Icon: ListOrdered },
  { to: "/cierre", label: "Cierre", Icon: Calculator },
  { to: "/clientes", label: "Clientes", Icon: Users },
  { to: "/menu", label: "Menú", Icon: UtensilsCrossed },
  { to: "/ajustes", label: "Ajustes", Icon: Settings },
];

function AppLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const turno = useTurnoActivo();

  useEffect(() => {
    aplicarTema(getAjustes().tema);
    if (!estaAutenticado()) navigate({ to: "/" });
    else setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className={`no-print flex items-center justify-between gap-2 border-b border-border px-3 py-1 text-[11px] font-bold sm:px-4 sm:py-1.5 sm:text-xs ${turno ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
        <span className="truncate">
          {turno
            ? `🟢 ${turnoLabel(turno.turno)} · ${new Date(turno.inicio).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
            : "⚪ Sin turno activo"}
        </span>
        <Link to="/cierre" className="rounded-lg bg-card px-2 py-0.5 text-foreground hover:bg-accent">Turno</Link>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (oculto en móvil) */}
        <aside className="hidden md:flex w-20 lg:w-28 flex-col items-center gap-2 bg-sidebar py-4 text-sidebar-foreground">
          <div className="mb-2 flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
            <img src="/xolo-logo.jpeg" alt="Xölo" className="h-full w-full object-contain" />
          </div>
          {nav.map(({ to, label, Icon }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex w-16 lg:w-20 flex-col items-center gap-1 rounded-2xl py-3 text-[10px] lg:text-xs font-semibold transition active:scale-95 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                }`}
                title={label}
              >
                <Icon className="h-6 w-6" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => { cerrarSesion(); navigate({ to: "/" }); }}
            className="flex w-16 lg:w-20 flex-col items-center gap-1 rounded-2xl py-3 text-[10px] lg:text-xs font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent active:scale-95"
            title="Salir"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </aside>

        <main className="flex-1 overflow-hidden pb-[68px] md:pb-0 bottom-nav-safe">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (móvil) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-sidebar-border bg-sidebar text-sidebar-foreground bottom-nav-safe"
        style={{ minHeight: 64 }}
      >
        {nav.map(({ to, label, Icon }) => {
          const active = loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold ${
                active ? "text-primary" : "text-sidebar-foreground/80"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => { cerrarSesion(); navigate({ to: "/" }); }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold text-sidebar-foreground/70"
        >
          <LogOut className="h-5 w-5" />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  );
}
