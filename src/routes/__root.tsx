import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

const RECOVERY_KEY = "beauty:root-error-recovery";

async function recoverApplication() {
  try {
    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }
  } catch {
    // Cache API may be unavailable in restricted browser modes.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("__recovery", Date.now().toString());
  window.location.replace(url.toString());
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) ?? 0);
    const alreadyRecovered = Date.now() - lastRecovery < 30_000;
    if (!alreadyRecovered) {
      sessionStorage.setItem(RECOVERY_KEY, Date.now().toString());
      void recoverApplication();
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou volte para a página inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              sessionStorage.removeItem(RECOVERY_KEY);
              void recoverApplication();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Atualizar sistema
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BeautySaaS — Sistema de agendamento white label" },
      {
        name: "description",
        content:
          "Plataforma white label de agendamento para barbearias, salões, manicures e designers de sobrancelhas. Gestão completa com identidade visual própria.",
      },
      { property: "og:title", content: "BeautySaaS — Sistema de agendamento white label" },
      {
        property: "og:description",
        content:
          "Plataforma white label de agendamento para barbearias, salões, manicures e designers de sobrancelhas. Gestão completa com identidade visual própria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BeautySaaS — Sistema de agendamento white label" },
      {
        name: "twitter:description",
        content:
          "Plataforma white label de agendamento para barbearias, salões, manicures e designers de sobrancelhas. Gestão completa com identidade visual própria.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7eccc709-dfdf-413f-934a-462f962c9339/id-preview-71f37bd3--2ca49ee1-054e-42b1-aa32-f886e5da6ed8.lovable.app-1784315384853.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7eccc709-dfdf-413f-934a-462f962c9339/id-preview-71f37bd3--2ca49ee1-054e-42b1-aa32-f886e5da6ed8.lovable.app-1784315384853.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(RECOVERY_KEY);
      const url = new URL(window.location.href);
      if (url.searchParams.has("__recovery")) {
        url.searchParams.delete("__recovery");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, []);
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
