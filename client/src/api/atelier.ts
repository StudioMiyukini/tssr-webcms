import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ── Types ──
/*
 * @id     tssr.apiAtelier
 * @do     exposer_hooks_atelier
 * @role   orchestration
 * @layer  infra
 * @human  Hooks et appels d'API de l'atelier : progression, exercices et données de formation.
 */
export interface AtelierMe { canSave: boolean; kind?: 'admin' | 'customer'; name?: string; }
export interface AtelierProjectMeta { id: number; name: string; created_at: string; updated_at: string; }
export interface AtelierProjectFull extends AtelierProjectMeta { data: Record<string, unknown>; }

// ── Identité (le client sait s'il peut enregistrer) ──
export const useAtelierMe = () =>
  useQuery<AtelierMe>({ queryKey: ['atelier-me'], queryFn: () => apiGet('/api/atelier/me'), staleTime: 30_000 });

// ── Projets ──
export const useAtelierProjects = (enabled: boolean) =>
  useQuery<AtelierProjectMeta[]>({ queryKey: ['atelier-projects'], queryFn: () => apiGet('/api/atelier/projects'), enabled });

export const useAtelierProject = (id: number | null) =>
  useQuery<AtelierProjectFull>({ queryKey: ['atelier-project', id], queryFn: () => apiGet(`/api/atelier/projects/${id}`), enabled: id != null });

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; data?: Record<string, unknown> }) => apiPost<AtelierProjectFull>('/api/atelier/projects', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['atelier-projects'] }); },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; name?: string; data?: Record<string, unknown> }) =>
      apiPut<{ ok: boolean; id: number; name: string; updated_at: string }>(`/api/atelier/projects/${input.id}`, { name: input.name, data: input.data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['atelier-projects'] }); },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/atelier/projects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['atelier-projects'] }); },
  });
}
