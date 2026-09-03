import { QueryClient } from '@tanstack/react-query';

/*
 * @id     tssr.webQueryClient
 * @do     configurer_requetes
 * @role   orchestration
 * @layer  infra
 * @human  Client React Query : configuration des requêtes et du cache côté front.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 120_000, gcTime: 600_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
