import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 120_000, gcTime: 600_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
