import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { AdminSession, DashboardStats, RecentActivity, FeatureItem, FeatureKey, ThemeSettings, FormMetrics, EmailSettings, EmailLogRow, SiteSettings, AdminSiteSettings, SiteSettingsUpdate, CacheStats, SecurityStatus, PlanningRecord, PlanningInput, ForumCategory, ForumCategoryInput, ForumTopic } from '@shared/types';

// ===== Auth =====
export function useMe() {
  return useQuery<AdminSession>({ queryKey: ['me'], queryFn: () => apiGet('/api/auth/me'), retry: false });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) => apiPost<AdminSession>('/api/auth/login', body),
    onSuccess: (data) => { qc.setQueryData(['me'], data); },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/auth/logout'),
    onSuccess: () => { qc.clear(); },
  });
}

// ===== Features (modules activables) =====
export const useFeatures = () => useQuery<FeatureItem[]>({ queryKey: ['features'], queryFn: () => apiGet('/api/admin/features') });
export function useUpdateFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flags: Partial<Record<FeatureKey, boolean>>) => apiPut<FeatureItem[]>('/api/admin/features', { flags }),
    onSuccess: (data) => { qc.setQueryData(['features'], data); qc.invalidateQueries({ queryKey: ['public-features'] }); },
  });
}

// ===== Thème visuel =====
export const useThemeSettings = () => useQuery<ThemeSettings>({ queryKey: ['theme-settings'], queryFn: () => apiGet('/api/admin/theme') });
export function useUpdateThemeSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ThemeSettings) => apiPut<ThemeSettings>('/api/admin/theme', data),
    onSuccess: (data) => { qc.setQueryData(['theme-settings'], data); qc.invalidateQueries({ queryKey: ['public-theme'] }); },
  });
}

// ===== Médias =====
export interface MediaRecord { id: number; filename: string; original_name: string; url: string; mime: string; size: number; created_at: string | null; }
export const useMediaList = () => useQuery<MediaRecord[]>({ queryKey: ['media'], queryFn: () => apiGet('/api/admin/media') });
export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: { filename: string; dataUrl: string }) => apiPost<MediaRecord>('/api/admin/media', file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); },
  });
}
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/admin/media/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); },
  });
}

// ===== Formulaires (type Google Forms) =====
export interface FormRow { id: number; title: string; slug: string; description: string; published: number; submissions_count: number; }
export interface FormRecord { id: number; title: string; slug: string; description: string; fields_json: string; success_message: string; published: number; }
export interface FormInput { title: string; slug?: string; description?: string; fields_json?: string; success_message?: string; published?: number; }
export const Forms = makeResourceHooks<FormRow, FormRecord, FormInput>('forms', '/api/admin/forms');

export interface FormSubmissionRow { id: number; created_at: string; payload: Record<string, unknown>; }
export const useFormSubmissions = (id: number | null) => useQuery<FormSubmissionRow[]>({ queryKey: ['form-subs', id], queryFn: () => apiGet(`/api/admin/forms/${id}/submissions`), enabled: id != null && id > 0 });
export const useFormMetrics = (id: number | null) => useQuery<FormMetrics>({ queryKey: ['form-metrics', id], queryFn: () => apiGet(`/api/admin/forms/${id}/metrics`), enabled: id != null && id > 0 });
export function useDeleteFormSubmission(formId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sid: number) => apiDelete(`/api/admin/forms/${formId}/submissions/${sid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['form-subs', formId] }); qc.invalidateQueries({ queryKey: ['form-metrics', formId] }); },
  });
}

// ===== Blog / actualités =====
export interface PostRow { id: number; title: string; slug: string; category: string; published: number; featured: number; published_at: string; }
export interface PostRecord { id: number; title: string; slug: string; excerpt: string; content: string; builder_json: string; cover_url: string; category: string; author: string; published: number; featured: number; published_at: string; }
export interface PostInput { title: string; slug?: string; excerpt?: string; content?: string; builder_json?: string; cover_url?: string; category?: string; author?: string; published?: number; featured?: number; published_at?: string; }
export const Posts = makeResourceHooks<PostRow, PostRecord, PostInput>('posts', '/api/admin/posts');

// ===== Commentaires (modération) =====
export interface AdminCommentRow { id: number; post_id: number; author: string; email: string; body: string; status: string; created_at: string; post_title: string; post_slug: string; }
export const useComments = (status?: string) => useQuery<AdminCommentRow[]>({ queryKey: ['comments', status || ''], queryFn: () => apiGet(`/api/admin/comments${status ? `?status=${status}` : ''}`) });
export function useApproveComment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => apiPost(`/api/admin/comments/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }) });
}
export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => apiDelete(`/api/admin/comments/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }) });
}

// ===== Agenda / événements =====
export interface EventRecord { id: number; title: string; slug: string; description: string; location: string; start_at: string; end_at: string; all_day: number; url: string; image_url: string; published: number; }
export interface EventInput { title: string; slug?: string; description?: string; location?: string; start_at: string; end_at?: string; all_day?: number; url?: string; image_url?: string; published?: number; }
export const Events = makeResourceHooks<EventRecord, EventRecord, EventInput>('events', '/api/admin/events');

// ===== Planning =====
export const Plannings = makeResourceHooks<PlanningRecord, PlanningRecord, PlanningInput>('plannings', '/api/admin/plannings');

// ===== Forum (admin) =====
export const ForumCategories = makeResourceHooks<ForumCategory, ForumCategory, ForumCategoryInput>('forum-categories', '/api/admin/forum/categories');
export const useForumTopicsAdmin = () => useQuery<ForumTopic[]>({ queryKey: ['forum-topics-admin'], queryFn: () => apiGet('/api/admin/forum/topics') });
export function useModerateForumTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { pinned?: number; locked?: number } }) => apiPut(`/api/admin/forum/topics/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-topics-admin'] }),
  });
}
export function useDeleteForumTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/admin/forum/topics/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-topics-admin'] }),
  });
}

// ===== Emailing =====
export const useEmailSettings = () => useQuery<EmailSettings>({ queryKey: ['email-settings'], queryFn: () => apiGet('/api/admin/email') });
export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmailSettings) => apiPut<EmailSettings>('/api/admin/email', data),
    onSuccess: (data) => { qc.setQueryData(['email-settings'], data); },
  });
}
export const useEmailLogs = () => useQuery<EmailLogRow[]>({ queryKey: ['email-logs'], queryFn: () => apiGet('/api/admin/email/logs') });
export function useSendTestEmail() {
  return useMutation({ mutationFn: (to: string) => apiPost<{ ok: boolean; skipped?: boolean }>('/api/admin/email/test', { to }) });
}

// ===== Modèles d'email + Newsletter =====
export interface EmailTemplateRecord { id: number; name: string; subject: string; body_html: string; }
export interface EmailTemplateInput { name: string; subject?: string; body_html?: string; }
export const EmailTemplates = makeResourceHooks<EmailTemplateRecord, EmailTemplateRecord, EmailTemplateInput>('email-templates', '/api/admin/email-templates');

export interface CampaignRow { id: number; subject: string; audience: string; recipients: number; sent: number; skipped: number; failed: number; created_at: string; }
export const useCampaigns = () => useQuery<CampaignRow[]>({ queryKey: ['campaigns'], queryFn: () => apiGet('/api/admin/newsletter/campaigns') });

export interface NewsletterAudience { count: number; sample: string[] }
export const useNewsletterAudience = (source: string, formId?: number) => useQuery<NewsletterAudience>({
  queryKey: ['nl-audience', source, formId],
  queryFn: () => apiGet(`/api/admin/newsletter/audience?source=${source}${formId ? `&formId=${formId}` : ''}`),
  enabled: source === 'customers' || (source === 'form' && !!formId),
});

export interface NewsletterSend { subject: string; body_html: string; source: 'customers' | 'form' | 'manual'; formId?: number; emails?: string[]; }
export interface NewsletterResult { recipients: number; sent: number; skipped: number; failed: number; capped: boolean; }
export function useSendNewsletter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewsletterSend) => apiPost<NewsletterResult>('/api/admin/newsletter/send', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); qc.invalidateQueries({ queryKey: ['email-logs'] }); },
  });
}

// ===== Performance & sécurité =====
export const useSiteSettings = () => useQuery<AdminSiteSettings>({ queryKey: ['site-settings'], queryFn: () => apiGet('/api/admin/site') });
export function useUpdateSiteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SiteSettingsUpdate) => apiPut<AdminSiteSettings>('/api/admin/site', data),
    onSuccess: (data) => {
      qc.setQueryData(['site-settings'], data);
      qc.invalidateQueries({ queryKey: ['cache-stats'] });
      qc.invalidateQueries({ queryKey: ['security-status'] });
    },
  });
}
export const useCacheStats = () => useQuery<CacheStats>({ queryKey: ['cache-stats'], queryFn: () => apiGet('/api/admin/cache') });
export function useClearCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<CacheStats>('/api/admin/cache/clear'),
    onSuccess: (data) => { qc.setQueryData(['cache-stats'], data); },
  });
}
export const useSecurityStatus = () => useQuery<SecurityStatus>({ queryKey: ['security-status'], queryFn: () => apiGet('/api/admin/security') });

// ===== Notes / documents (espace de travail type Google Keep/Docs) =====
export interface NoteRow { id: number; title: string; snippet: string; folder_id: number; color: string; pinned: number; archived: number; updated_at: string; }
export interface NoteRecord { id: number; folder_id: number; title: string; content: string; color: string; pinned: number; archived: number; created_at: string; updated_at: string; }
export interface NoteFolderRow { id: number; name: string; count: number; }
export interface NotesQuery { archived?: boolean; folder?: number | null; q?: string; }
export interface NoteUpdate { title?: string; content?: string; folder_id?: number; color?: string; pinned?: number; archived?: number; }

export function notesKey(p: NotesQuery) { return ['notes', p.archived ? 1 : 0, p.folder ?? null, p.q || ''] as const; }

export const useNotes = (p: NotesQuery) => useQuery<NoteRow[]>({
  queryKey: notesKey(p),
  queryFn: () => apiGet(`/api/admin/notes?archived=${p.archived ? 1 : 0}${p.folder != null ? `&folder=${p.folder}` : ''}${p.q ? `&q=${encodeURIComponent(p.q)}` : ''}`),
});
export const useNote = (id: number | null) => useQuery<NoteRecord>({ queryKey: ['note', id], queryFn: () => apiGet(`/api/admin/notes/${id}`), enabled: id != null && id > 0 });

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { folder_id?: number }) => apiPost<NoteRecord>('/api/admin/notes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: NoteUpdate }) => apiPut<{ ok: boolean; id: number; updated_at: string }>(`/api/admin/notes/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}
export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/admin/notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export const useNoteFolders = () => useQuery<NoteFolderRow[]>({ queryKey: ['note-folders'], queryFn: () => apiGet('/api/admin/note-folders') });
export function useCreateNoteFolder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (name: string) => apiPost<NoteFolderRow>('/api/admin/note-folders', { name }), onSuccess: () => qc.invalidateQueries({ queryKey: ['note-folders'] }) });
}
export function useRenameNoteFolder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => apiPut(`/api/admin/note-folders/${id}`, { name }), onSuccess: () => qc.invalidateQueries({ queryKey: ['note-folders'] }) });
}
export function useDeleteNoteFolder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => apiDelete(`/api/admin/note-folders/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['note-folders'] }); qc.invalidateQueries({ queryKey: ['notes'] }); } });
}

// ===== Dashboard =====
export const useDashboardStats = () => useQuery<DashboardStats>({ queryKey: ['dashboard-stats'], queryFn: () => apiGet('/api/admin/dashboard/stats') });
export const useDashboardActivity = () => useQuery<RecentActivity>({ queryKey: ['dashboard-activity'], queryFn: () => apiGet('/api/admin/dashboard/activity') });

// ===== Generic CRUD factory =====
function makeResourceHooks<TList, TItem, TInput>(baseKey: string, path: string) {
  return {
    useList: () => useQuery<TList[]>({ queryKey: [baseKey], queryFn: () => apiGet(path) }),
    useOne: (id: number | null) => useQuery<TItem>({ queryKey: [baseKey, id], queryFn: () => apiGet(`${path}/${id}`), enabled: id != null && id > 0 }),
    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (data: TInput) => apiPost<TItem>(path, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: [baseKey] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
      });
    },
    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, data }: { id: number; data: TInput }) => apiPut<TItem>(`${path}/${id}`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: [baseKey] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
      });
    },
    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: number) => apiDelete(`${path}/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: [baseKey] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
      });
    },
  };
}

// ===== Types =====
export interface PageRecord { id: number; title: string; slug: string; excerpt: string; content: string; builder_json: string; published: number; updated_at: string | null; created_at: string | null; }
export interface PageInput { title: string; slug?: string; excerpt?: string; content?: string; builder_json?: string; published?: number; }

export interface ProductRecord { id: number; name: string; slug: string; description: string; short_description: string; price_cents: number; sale_price_cents: number; compare_at_price_cents: number; stock: number; image_url: string; sku: string; category: string; featured: number; manage_stock: number; published: number; variants_json: string; }
export interface ProductInput { name: string; slug?: string; description?: string; short_description?: string; price_cents?: number; sale_price_cents?: number; compare_at_price_cents?: number; stock?: number; image_url?: string; sku?: string; category?: string; featured?: number; manage_stock?: number; published?: number; variants_json?: string; }

export interface MenuRecord { id: number; label: string; url: string; sort_order: number; }
export interface MenuInput { label: string; url: string; sort_order?: number; }

export interface CouponRecord { id: number; code: string; label: string; discount_type: 'percent' | 'fixed'; discount_value: number; min_subtotal_cents: number; active: number; }
export interface CouponInput { code: string; label?: string; discount_type?: 'percent' | 'fixed'; discount_value?: number; min_subtotal_cents?: number; active?: number; }

export interface ShippingRecord { id: number; name: string; description: string; price_cents: number; free_from_cents: number; active: number; sort_order: number; }
export interface ShippingInput { name: string; description?: string; price_cents?: number; free_from_cents?: number; active?: number; sort_order?: number; }

export interface OrderRow { id: number; order_number: string; customer_name: string; customer_email: string; status: string; total_cents: number; tax_cents: number; shipping_price_cents: number; created_at: string; items_count: number; }
export interface OrderDetail { order: { id: number; order_number: string; customer_name: string; customer_email: string; customer_phone: string; customer_company: string; shipping_address: string; notes: string; status: string; total_cents: number; subtotal_cents: number; discount_cents: number; tax_cents: number; shipping_price_cents: number; shipping_method_name: string; coupon_code: string; created_at: string; }; items: Array<{ id: number; product_name: string; variant_label: string; sku: string; quantity: number; unit_price_cents: number; line_total_cents: number; }>; }

export interface QuoteFormRow { id: number; title: string; slug: string; description: string; published: number; submissions_count: number; }
export interface QuoteFormRecord { id: number; title: string; slug: string; description: string; intro_html: string; cta_label: string; success_message: string; recipient_email: string; fields_json: string; blocks_json: string; published: number; }
export interface QuoteFormInput { title: string; slug?: string; description?: string; intro_html?: string; cta_label?: string; success_message?: string; recipient_email?: string; fields_json?: string; blocks_json?: string; published?: number; }

export interface QuoteSubmissionRow { id: number; customer_name: string; customer_email: string; customer_company: string; status: string; created_at: string; computed_total_cents: number; form_title: string; form_slug: string; }
export interface QuoteSubmissionDetail extends QuoteSubmissionRow { payload_json: string; notes: string; }

// ===== Hooks =====
export const Pages = makeResourceHooks<PageRecord, PageRecord, PageInput>('pages', '/api/admin/pages');
export const Products = makeResourceHooks<ProductRecord, ProductRecord, ProductInput>('products', '/api/admin/products');
export const Menus = makeResourceHooks<MenuRecord, MenuRecord, MenuInput>('menus', '/api/admin/menus');
export const Coupons = makeResourceHooks<CouponRecord, CouponRecord, CouponInput>('coupons', '/api/admin/coupons');
export const Shipping = makeResourceHooks<ShippingRecord, ShippingRecord, ShippingInput>('shipping', '/api/admin/shipping-methods');
export const QuoteForms = makeResourceHooks<QuoteFormRow, QuoteFormRecord, QuoteFormInput>('quote-forms', '/api/admin/quote-forms');

// Orders (no create/update beyond status)
export const useOrders = () => useQuery<OrderRow[]>({ queryKey: ['orders'], queryFn: () => apiGet('/api/admin/orders') });
export const useOrder = (id: number | null) => useQuery<OrderDetail>({ queryKey: ['orders', id], queryFn: () => apiGet(`/api/admin/orders/${id}`), enabled: id != null && id > 0 });
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiPost(`/api/admin/orders/${id}/status`, { status }),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['orders', vars.id] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
  });
}

// Quote submissions
export const useQuoteSubmissions = () => useQuery<QuoteSubmissionRow[]>({ queryKey: ['quote-submissions'], queryFn: () => apiGet('/api/admin/quote-submissions') });
export const useQuoteSubmission = (id: number | null) => useQuery<QuoteSubmissionDetail>({ queryKey: ['quote-submissions', id], queryFn: () => apiGet(`/api/admin/quote-submissions/${id}`), enabled: id != null && id > 0 });
export function useDeleteQuoteSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/admin/quote-submissions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quote-submissions'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
  });
}
