import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { ProductRecord, PageRecord, MenuRecord, ShippingRecord, CouponRecord, QuoteFormRecord, EventRecord, PostRecord } from './hooks';
import type { FeatureFlags, ThemeSettings, FormField, SiteAccessState, PlanningRecord, ForumCategoryPublic, ForumCategory, ForumTopic, ForumTopicView } from '@shared/types';

// ===== Public types =====
export interface CartLineDetail {
  lineKey: string;
  product: ProductRecord;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  variantKey: string;
  variantLabel: string;
  effectiveSku: string;
  effectiveStock: number;
}

export interface CartDetails {
  items: CartLineDetail[];
  subtotalCents: number;
  count: number;
  coupon: CouponRecord | null;
  discountCents: number;
  shippingMethod: (ShippingRecord & { computed_price_cents: number }) | null;
  shippingCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  availableShippingMethods?: ShippingRecord[];
}

export interface QuoteFormPublic {
  form: QuoteFormRecord;
  blocks: Array<{ id: string; type: string; name: string; label: string; required: boolean; placeholder: string; options: string[]; help_text: string; width: string; }>;
  fields: Array<{ name: string; label: string; type: string; required: boolean; placeholder: string; options: string[]; }>;
}

export interface CustomerSession { id: number; name: string; email: string; phone: string; company: string; address: string; }
export interface CustomerOrder { id: number; order_number: string; status: string; total_cents: number; created_at: string; tax_cents: number; shipping_price_cents: number; }

// ===== Public reads =====
export const usePublicFeatures = () => useQuery<FeatureFlags>({ queryKey: ['public-features'], queryFn: () => apiGet('/api/public/features'), staleTime: 60_000 });
export const usePublicThemeSettings = () => useQuery<ThemeSettings>({ queryKey: ['public-theme'], queryFn: () => apiGet('/api/public/theme'), staleTime: 60_000 });

// ===== Planning =====
export const usePublicPlannings = () => useQuery<PlanningRecord[]>({ queryKey: ['public-plannings'], queryFn: () => apiGet('/api/public/plannings') });
export const usePublicPlanning = (slug: string) => useQuery<PlanningRecord>({ queryKey: ['public-planning', slug], queryFn: () => apiGet(`/api/public/plannings/${slug}`), enabled: !!slug });

// ===== Forum =====
export const usePublicForum = () => useQuery<ForumCategoryPublic[]>({ queryKey: ['public-forum'], queryFn: () => apiGet('/api/public/forum') });
export const usePublicForumCategory = (catSlug: string) => useQuery<{ category: ForumCategory; topics: ForumTopic[] }>({ queryKey: ['public-forum-cat', catSlug], queryFn: () => apiGet(`/api/public/forum/${catSlug}`), enabled: !!catSlug });
export const usePublicForumTopic = (slug: string) => useQuery<ForumTopicView>({ queryKey: ['public-forum-topic', slug], queryFn: () => apiGet(`/api/public/forum/topics/${slug}`), enabled: !!slug });
export function useCreateForumTopic(catSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; author: string; body: string }) => apiPost<ForumTopic>(`/api/public/forum/${catSlug}/topics`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['public-forum-cat', catSlug] }); qc.invalidateQueries({ queryKey: ['public-forum'] }); },
  });
}
export function useCreateForumReply(topicSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { author: string; body: string }) => apiPost(`/api/public/forum/topics/${topicSlug}/replies`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-forum-topic', topicSlug] }),
  });
}

// ===== Note embarquée (bloc « note ») =====
export interface PublicNote { id: number; title: string; content: string; color: string; }
export const usePublicNote = (id: number) => useQuery<PublicNote>({ queryKey: ['public-note', id], queryFn: () => apiGet(`/api/public/notes/${id}`), enabled: id > 0 });

// ===== Confidentialité (site privé) =====
export const useSiteAccess = () => useQuery<SiteAccessState>({ queryKey: ['site-access'], queryFn: () => apiGet('/api/site-access'), staleTime: 30_000 });
export function useUnlockSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => apiPost<SiteAccessState>('/api/site-access', { password }),
    onSuccess: (data) => { qc.setQueryData(['site-access'], data); qc.invalidateQueries(); }, // recharge tout le contenu débloqué
  });
}

export interface SearchResult { type: string; title: string; excerpt: string; url: string; }
export interface SearchResults { items: SearchResult[]; total: number; page: number; pageSize: number; }
export const usePublicSearch = (q: string, page = 1) => useQuery<SearchResults>({ queryKey: ['search', q, page], queryFn: () => apiGet(`/api/public/search?q=${encodeURIComponent(q)}&page=${page}`), enabled: q.trim().length >= 2 });

export interface PublicComment { id: number; author: string; body: string; created_at: string; }
export const usePostComments = (slug: string) => useQuery<PublicComment[]>({ queryKey: ['post-comments', slug], queryFn: () => apiGet(`/api/public/posts/${slug}/comments`), enabled: !!slug });
export function useSubmitComment(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { author: string; email: string; body: string; website?: string }) => apiPost<{ ok: true; message: string }>(`/api/public/posts/${slug}/comments`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-comments', slug] }),
  });
}

export interface PublicPostListItem { id: number; title: string; slug: string; excerpt: string; cover_url: string; category: string; author: string; featured: number; published_at: string; }
export interface PostsPage { items: PublicPostListItem[]; total: number; page: number; pageSize: number; }
export const usePublicPosts = (opts: { category?: string; page?: number; limit?: number; featured?: boolean } = {}) => {
  const params = new URLSearchParams();
  if (opts.category) params.set('category', opts.category);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.featured) params.set('featured', '1');
  const qs = params.toString();
  return useQuery<PostsPage>({ queryKey: ['public-posts', qs], queryFn: () => apiGet(`/api/public/posts${qs ? `?${qs}` : ''}`) });
};
export const usePublicRelated = (slug: string) => useQuery<PublicPostListItem[]>({ queryKey: ['public-related', slug], queryFn: () => apiGet(`/api/public/posts/${slug}/related`), enabled: !!slug });
export const usePublicPostCategories = () => useQuery<string[]>({ queryKey: ['public-post-cats'], queryFn: () => apiGet('/api/public/posts/categories') });
export const usePublicPost = (slug: string) => useQuery<PostRecord>({ queryKey: ['public-post', slug], queryFn: () => apiGet(`/api/public/posts/${slug}`), enabled: !!slug });

export const usePublicEvents = () => useQuery<EventRecord[]>({ queryKey: ['public-events'], queryFn: () => apiGet('/api/public/events') });
export const usePublicEvent = (slug: string) => useQuery<EventRecord>({ queryKey: ['public-event', slug], queryFn: () => apiGet(`/api/public/events/${slug}`), enabled: !!slug });

export interface PublicForm { id: number; title: string; slug: string; description: string; success_message: string; fields: FormField[]; }
export const usePublicForm = (slug: string) => useQuery<PublicForm>({ queryKey: ['public-form', slug], queryFn: () => apiGet(`/api/public/forms/${slug}`), enabled: !!slug });
export function useSubmitForm(slug: string) {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost<{ ok: true; success_message: string }>(`/api/public/forms/${slug}/submit`, { payload }),
  });
}
export const usePublicMenus = () => useQuery<MenuRecord[]>({ queryKey: ['public-menus'], queryFn: () => apiGet('/api/public/menus') });
export const usePublicPage = (slug: string) => useQuery<PageRecord>({ queryKey: ['public-page', slug], queryFn: () => apiGet(`/api/public/pages/${slug}`), enabled: !!slug });
export const usePublicProducts = (category?: string) => useQuery<ProductRecord[]>({ queryKey: ['public-products', category || ''], queryFn: () => apiGet(`/api/public/products${category ? `?category=${encodeURIComponent(category)}` : ''}`) });
export const usePublicCategories = () => useQuery<string[]>({ queryKey: ['public-categories'], queryFn: () => apiGet('/api/public/categories') });
export const usePublicProduct = (slug: string) => useQuery<{ product: ProductRecord; related: ProductRecord[] }>({ queryKey: ['public-product', slug], queryFn: () => apiGet(`/api/public/products/${slug}`), enabled: !!slug });
export const usePublicQuoteForm = (slug: string) => useQuery<QuoteFormPublic>({ queryKey: ['public-quote-form', slug], queryFn: () => apiGet(`/api/public/quote-forms/${slug}`), enabled: !!slug });

export function useSubmitQuote(slug: string) {
  return useMutation({
    mutationFn: (payload: { customer_name: string; customer_email: string; customer_phone?: string; customer_company?: string; notes?: string; payload: Record<string, string> }) =>
      apiPost<{ ok: true; id: number; success_message: string }>(`/api/public/quote-forms/${slug}/submit`, payload),
  });
}

// ===== Cart =====
export const useCart = () => useQuery<CartDetails>({ queryKey: ['cart'], queryFn: () => apiGet('/api/cart'), staleTime: 0 });

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { product_id: number; quantity?: number; variant_key?: string }) => apiPost<CartDetails>('/api/cart/add', data),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}
export function useUpdateCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ lineKey: string; quantity: number }>) => apiPost<CartDetails>('/api/cart/update', { items }),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}
export function useRemoveCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineKey: string) => apiPost<CartDetails>('/api/cart/remove', { lineKey }),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}
export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiPost<CartDetails>('/api/cart/coupon', { code }),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}
export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<CartDetails>('/api/cart/coupon'),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}
export function useChooseShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shipping_method_id: number) => apiPost<CartDetails>('/api/cart/shipping', { shipping_method_id }),
    onSuccess: (data) => { qc.setQueryData(['cart'], data); },
  });
}

export function useCheckoutManual() {
  return useMutation({
    mutationFn: (data: { customer_name: string; customer_email: string; customer_phone?: string; customer_company?: string; shipping_address?: string; notes?: string }) =>
      apiPost<{ ok: true; order_number: string; total_cents: number }>('/api/checkout', data),
  });
}

export function useCheckoutStripe() {
  return useMutation({
    mutationFn: (data: { customer_name: string; customer_email: string; customer_phone?: string; customer_company?: string; shipping_address?: string; notes?: string }) =>
      apiPost<{ url: string; session_id: string }>('/api/checkout/stripe', data),
  });
}

export function useFinalizeStripe() {
  return useMutation({
    mutationFn: (session_id: string) => apiPost<{ ok: true; order_number: string; total_cents: number }>('/api/checkout/stripe/finalize', { session_id }),
  });
}

// ===== Customer auth =====
export const useCustomerMe = () => useQuery<CustomerSession>({ queryKey: ['customer-me'], queryFn: () => apiGet('/api/customer/me'), retry: false });
export function useCustomerLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => apiPost<CustomerSession>('/api/customer/login', data),
    onSuccess: (data) => { qc.setQueryData(['customer-me'], data); qc.invalidateQueries({ queryKey: ['site-access'] }); qc.invalidateQueries(); },
  });
}
export function useCustomerRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; phone?: string; company?: string; address?: string }) => apiPost<CustomerSession>('/api/customer/register', data),
    onSuccess: (data) => { qc.setQueryData(['customer-me'], data); qc.invalidateQueries({ queryKey: ['site-access'] }); qc.invalidateQueries(); },
  });
}
export function useCustomerLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/customer/logout'),
    onSuccess: () => { qc.removeQueries({ queryKey: ['customer-me'] }); qc.invalidateQueries({ queryKey: ['site-access'] }); qc.invalidateQueries(); },
  });
}
export const useCustomerOrders = () => useQuery<CustomerOrder[]>({ queryKey: ['customer-orders'], queryFn: () => apiGet('/api/customer/orders'), retry: false });

// ===== Profil =====
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone?: string; company?: string; address?: string }) => apiPut<CustomerSession>('/api/customer/me', data),
    onSuccess: (d) => { qc.setQueryData(['customer-me'], d); },
  });
}
export function useChangePassword() {
  return useMutation({ mutationFn: (data: { current: string; next: string }) => apiPut('/api/customer/password', data) });
}

// ===== Cloud privé par profil =====
export interface CloudFile { id: number; original_name: string; mime: string; size: number; created_at: string; }
export const useMyFiles = () => useQuery<CloudFile[]>({ queryKey: ['cloud-files'], queryFn: () => apiGet('/api/customer/cloud'), retry: false });
export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { filename: string; dataUrl: string }) => apiPost<CloudFile>('/api/customer/cloud', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cloud-files'] }),
  });
}
export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/customer/cloud/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cloud-files'] }),
  });
}
