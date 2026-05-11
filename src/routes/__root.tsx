import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "XÖLO BURRITOS NORTEÑOS" },
      { name: "description", content: "Solo con tu número repetimos tus pedidos anteriores y guardamos tu dirección. Menos espera, más burritos." },
      { property: "og:title", content: "XÖLO BURRITOS NORTEÑOS" },
      { name: "twitter:title", content: "XÖLO BURRITOS NORTEÑOS" },
      { property: "og:description", content: "Solo con tu número repetimos tus pedidos anteriores y guardamos tu dirección. Menos espera, más burritos." },
      { name: "twitter:description", content: "Solo con tu número repetimos tus pedidos anteriores y guardamos tu dirección. Menos espera, más burritos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e705a67f-5dad-427a-bc3b-001fff4457a1/id-preview-73e20036--e42d4642-2967-4eae-b890-c35b9050bd26.lovable.app-1777513958976.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e705a67f-5dad-427a-bc3b-001fff4457a1/id-preview-73e20036--e42d4642-2967-4eae-b890-c35b9050bd26.lovable.app-1777513958976.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" translate="no" className="notranslate">
      <head>
        <meta name="google" content="notranslate" />
        <HeadContent />
      </head>
      <body translate="no" className="notranslate">
        {children}
        <div id="modal-root" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppErrorBoundary>
      <Outlet />
      <Toaster position="top-center" richColors />
    </AppErrorBoundary>
  );
}
