import { Link, Outlet, useLocation, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Users, ListOrdered, Settings, LogOut, UtensilsCrossed } from "lucide-react";
import { estaAutenticado, cerrarSesion } from "@/lib/pin";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const nav = [
  { to: "/caja", label: "Caja", Icon: ShoppingCart },
  { to: "/pedidos", label: "Pedidos", Icon: ListOrdered },
  { to: "/clientes", label: "Clientes", Icon: Users },
  { to: "/menu", label: "Menú", Icon: UtensilsCrossed },
  { to: "/ajustes", label: "Ajustes", Icon: Settings },
];

function AppLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!estaAutenticado()) navigate({ to: "/" });
    else setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-24 flex-col items-center gap-2 bg-sidebar py-4 text-sidebar-foreground sm:w-28">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
          🌯
        </div>
        {nav.map(({ to, label, Icon }) => {
          const active = loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold transition active:scale-95 ${
                active
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => { cerrarSesion(); navigate({ to: "/" }); }}
          className="flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent active:scale-95"
        >
          <LogOut className="h-5 w-5" />
          Salir
        </button>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
