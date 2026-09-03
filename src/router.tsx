import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetch em toda montagem/foco de aba: reduz muito o número
        // de requisições ao backend sem prejudicar a atualização dos dados
        // (mutations continuam invalidando as queries afetadas).
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Carrega o código da próxima tela enquanto o usuário aponta/toca no link.
    // O resultado permanece válido por um minuto, evitando repetir loaders e
    // downloads quando ele alterna entre abas do painel.
    defaultPreload: "intent",
    defaultPreloadDelay: 60,
    defaultPreloadStaleTime: 60_000,
  });


  return router;
};
