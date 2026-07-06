import { lazy, type ComponentType } from 'react';
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { FeatureGuard } from './components/FeatureGuard';
import { LoginPage } from './pages/Login'; // eager : rendu hors layout (pas de Suspense parent)

// Charge un export nommé en lazy → chunk séparé (admin/public/pages chargés à la demande).
function lazyNamed<M extends Record<string, ComponentType<any>>, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(() => loader().then(m => ({ default: m[name] })));
}

const DashboardPage = lazyNamed(() => import('./pages/Dashboard'), 'DashboardPage');
const FeaturesPage = lazyNamed(() => import('./pages/Features'), 'FeaturesPage');
const ThemePage = lazyNamed(() => import('./pages/Theme'), 'ThemePage');
const PerformancePage = lazyNamed(() => import('./pages/Performance'), 'PerformancePage');
const BackupPage = lazyNamed(() => import('./pages/Backup'), 'BackupPage');
const MediaPage = lazyNamed(() => import('./pages/Media'), 'MediaPage');
const NotesPage = lazyNamed(() => import('./pages/Notes'), 'NotesPage');
const EmailPage = lazyNamed(() => import('./pages/Email'), 'EmailPage');
const NewsletterPage = lazyNamed(() => import('./pages/Newsletter'), 'NewsletterPage');
const TemplatesListPage = lazyNamed(() => import('./pages/Templates'), 'TemplatesListPage');
const TemplateEditPage = lazyNamed(() => import('./pages/Templates'), 'TemplateEditPage');
const FormsListPage = lazyNamed(() => import('./pages/Forms'), 'FormsListPage');
const FormEditPage = lazyNamed(() => import('./pages/Forms'), 'FormEditPage');
const FormResultsPage = lazyNamed(() => import('./pages/Forms'), 'FormResultsPage');
const FormPage = lazyNamed(() => import('./pages/public/FormView'), 'FormPage');
const PostsListPage = lazyNamed(() => import('./pages/Posts'), 'PostsListPage');
const CommentsPage = lazyNamed(() => import('./pages/Comments'), 'CommentsPage');
const SearchPage = lazyNamed(() => import('./pages/public/Search'), 'SearchPage');
const PostEditPage = lazyNamed(() => import('./pages/Posts'), 'PostEditPage');
const BlogPage = lazyNamed(() => import('./pages/public/Blog'), 'BlogPage');
const PostViewPage = lazyNamed(() => import('./pages/public/Blog'), 'PostViewPage');
const CategoryPage = lazyNamed(() => import('./pages/public/Blog'), 'CategoryPage');
const EventsListPage = lazyNamed(() => import('./pages/Events'), 'EventsListPage');
const EventEditPage = lazyNamed(() => import('./pages/Events'), 'EventEditPage');
const AgendaPage = lazyNamed(() => import('./pages/public/Agenda'), 'AgendaPage');
const EventViewPage = lazyNamed(() => import('./pages/public/Agenda'), 'EventViewPage');
const PagesListPage = lazyNamed(() => import('./pages/Pages'), 'PagesListPage');
const PageEditPage = lazyNamed(() => import('./pages/Pages'), 'PageEditPage');
const ProductsListPage = lazyNamed(() => import('./pages/Products'), 'ProductsListPage');
const ProductEditPage = lazyNamed(() => import('./pages/Products'), 'ProductEditPage');
const OrdersListPage = lazyNamed(() => import('./pages/Orders'), 'OrdersListPage');
const OrderDetailPage = lazyNamed(() => import('./pages/Orders'), 'OrderDetailPage');
const MenusListPage = lazyNamed(() => import('./pages/Simple'), 'MenusListPage');
const MenuEditPage = lazyNamed(() => import('./pages/Simple'), 'MenuEditPage');
const CouponsListPage = lazyNamed(() => import('./pages/Simple'), 'CouponsListPage');
const CouponEditPage = lazyNamed(() => import('./pages/Simple'), 'CouponEditPage');
const ShippingListPage = lazyNamed(() => import('./pages/Simple'), 'ShippingListPage');
const ShippingEditPage = lazyNamed(() => import('./pages/Simple'), 'ShippingEditPage');
const QuoteFormsListPage = lazyNamed(() => import('./pages/Simple'), 'QuoteFormsListPage');
const QuoteFormEditPage = lazyNamed(() => import('./pages/Simple'), 'QuoteFormEditPage');
const QuoteSubmissionsListPage = lazyNamed(() => import('./pages/Simple'), 'QuoteSubmissionsListPage');
const QuoteSubmissionDetailPage = lazyNamed(() => import('./pages/Simple'), 'QuoteSubmissionDetailPage');
const HomePage = lazyNamed(() => import('./pages/public/Home'), 'HomePage');
const PageView = lazyNamed(() => import('./pages/public/PageView'), 'PageView');
const ShopPage = lazyNamed(() => import('./pages/public/Shop'), 'ShopPage');
const ProductView = lazyNamed(() => import('./pages/public/ProductView'), 'ProductView');
const QuoteFormView = lazyNamed(() => import('./pages/public/QuoteFormView'), 'QuoteFormView');
const QuoteThanksPage = lazyNamed(() => import('./pages/public/QuoteFormView'), 'QuoteThanksPage');
const CartPage = lazyNamed(() => import('./pages/public/Cart'), 'CartPage');
const CheckoutPage = lazyNamed(() => import('./pages/public/Checkout'), 'CheckoutPage');
const CheckoutSuccessPage = lazyNamed(() => import('./pages/public/CheckoutSuccess'), 'CheckoutSuccessPage');
const AccountPage = lazyNamed(() => import('./pages/public/Account'), 'AccountPage');
const AccountLoginPage = lazyNamed(() => import('./pages/public/Account'), 'AccountLoginPage');
const AccountRegisterPage = lazyNamed(() => import('./pages/public/Account'), 'AccountRegisterPage');
const CloudPage = lazyNamed(() => import('./pages/public/Account'), 'CloudPage');
const PlanningListPage = lazyNamed(() => import('./pages/Planning'), 'PlanningListPage');
const PlanningEditPage = lazyNamed(() => import('./pages/Planning'), 'PlanningEditPage');
const ForumAdminPage = lazyNamed(() => import('./pages/Forum'), 'ForumAdminPage');
const PlanningPublicPage = lazyNamed(() => import('./pages/public/PlanningPublic'), 'PlanningPublicPage');
const ForumPage = lazyNamed(() => import('./pages/public/ForumPublic'), 'ForumPage');
const ForumCategoryPage = lazyNamed(() => import('./pages/public/ForumPublic'), 'ForumCategoryPage');
const ForumTopicPage = lazyNamed(() => import('./pages/public/ForumPublic'), 'ForumTopicPage');

const rootRoute = createRootRoute();

// ===== Admin auth =====
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/login', component: LoginPage });

// ===== Admin layout (auth required) =====
const adminRoute = createRoute({ getParentRoute: () => rootRoute, id: 'admin', component: AdminLayout });

const dashRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin', component: DashboardPage });
const featuresRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/features', component: FeaturesPage });
const themeRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/theme', component: ThemePage });
const performanceRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/performance', component: PerformancePage });
const backupRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/backup', component: BackupPage });
const mediaRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/media', component: MediaPage });
const notesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/notes', component: NotesPage });
const emailRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/email', component: EmailPage });
const newsletterRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/newsletter', component: NewsletterPage });
const templatesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/email-templates', component: TemplatesListPage });
const templateNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/email-templates/new', component: TemplateEditPage });
const templateEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/email-templates/$id/edit', component: TemplateEditPage });
const formsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/forms', component: FormsListPage });
const formNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/forms/new', component: FormEditPage });
const formEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/forms/$id/edit', component: FormEditPage });
const formResultsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/forms/$id/results', component: FormResultsPage });
const postsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/posts', component: PostsListPage });
const postNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/posts/new', component: PostEditPage });
const postEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/posts/$id/edit', component: PostEditPage });
const commentsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/comments', component: CommentsPage });
const eventsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/events', component: EventsListPage });
const eventNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/events/new', component: EventEditPage });
const eventEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/events/$id/edit', component: EventEditPage });

const pagesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/pages', component: PagesListPage });
const pageNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/pages/new', component: PageEditPage });
const pageEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/pages/$id/edit', component: PageEditPage });

const productsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/products', component: ProductsListPage });
const productNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/products/new', component: ProductEditPage });
const productEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/products/$id/edit', component: ProductEditPage });

const ordersRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/orders', component: OrdersListPage });
const orderDetailRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/orders/$id', component: OrderDetailPage });

const menusRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/menus', component: MenusListPage });
const menuNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/menus/new', component: MenuEditPage });
const menuEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/menus/$id/edit', component: MenuEditPage });

const couponsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/coupons', component: CouponsListPage });
const couponNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/coupons/new', component: CouponEditPage });
const couponEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/coupons/$id/edit', component: CouponEditPage });

const shippingRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/shipping', component: ShippingListPage });
const shippingNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/shipping/new', component: ShippingEditPage });
const shippingEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/shipping/$id/edit', component: ShippingEditPage });

const quoteFormsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/quote-forms', component: QuoteFormsListPage });
const quoteFormNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/quote-forms/new', component: QuoteFormEditPage });
const quoteFormEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/quote-forms/$id/edit', component: QuoteFormEditPage });

const quoteSubsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/quote-submissions', component: QuoteSubmissionsListPage });
const quoteSubDetailRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/quote-submissions/$id', component: QuoteSubmissionDetailPage });

const planningsRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/plannings', component: PlanningListPage });
const planningNewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/plannings/new', component: PlanningEditPage });
const planningEditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/plannings/$id/edit', component: PlanningEditPage });
const forumAdminRoute = createRoute({ getParentRoute: () => adminRoute, path: '/admin/forum', component: ForumAdminPage });

// ===== Public layout =====
const publicRoute = createRoute({ getParentRoute: () => rootRoute, id: 'public', component: PublicLayout });

// Wrappers de pages publiques gardées par un module activable.
const ShopGuarded = () => <FeatureGuard feature="shop"><ShopPage /></FeatureGuard>;
const ProductGuarded = () => <FeatureGuard feature="shop"><ProductView /></FeatureGuard>;
const CartGuarded = () => <FeatureGuard feature="shop"><CartPage /></FeatureGuard>;
const CheckoutGuarded = () => <FeatureGuard feature="shop"><CheckoutPage /></FeatureGuard>;
const CheckoutSuccessGuarded = () => <FeatureGuard feature="shop"><CheckoutSuccessPage /></FeatureGuard>;
const DevisGuarded = () => <FeatureGuard feature="quotes"><QuoteFormView /></FeatureGuard>;
const DevisThanksGuarded = () => <FeatureGuard feature="quotes"><QuoteThanksPage /></FeatureGuard>;
const AccountGuarded = () => <FeatureGuard feature="accounts"><AccountPage /></FeatureGuard>;
const AccountLoginGuarded = () => <FeatureGuard feature="accounts"><AccountLoginPage /></FeatureGuard>;
const AccountRegisterGuarded = () => <FeatureGuard feature="accounts"><AccountRegisterPage /></FeatureGuard>;
const CloudGuarded = () => <FeatureGuard feature="accounts"><CloudPage /></FeatureGuard>;
const FormGuarded = () => <FeatureGuard feature="forms"><FormPage /></FeatureGuard>;
const AgendaGuarded = () => <FeatureGuard feature="events"><AgendaPage /></FeatureGuard>;
const EventViewGuarded = () => <FeatureGuard feature="events"><EventViewPage /></FeatureGuard>;
const BlogGuarded = () => <FeatureGuard feature="blog"><BlogPage /></FeatureGuard>;
const PostViewGuarded = () => <FeatureGuard feature="blog"><PostViewPage /></FeatureGuard>;
const CategoryGuarded = () => <FeatureGuard feature="blog"><CategoryPage /></FeatureGuard>;
const PlanningGuarded = () => <FeatureGuard feature="planning"><PlanningPublicPage /></FeatureGuard>;
const ForumGuarded = () => <FeatureGuard feature="forum"><ForumPage /></FeatureGuard>;
const ForumCatGuarded = () => <FeatureGuard feature="forum"><ForumCategoryPage /></FeatureGuard>;
const ForumTopicGuarded = () => <FeatureGuard feature="forum"><ForumTopicPage /></FeatureGuard>;

const homeRoute = createRoute({ getParentRoute: () => publicRoute, path: '/', component: HomePage });
const pageViewRoute = createRoute({ getParentRoute: () => publicRoute, path: '/pages/$slug', component: PageView });
// Slug racine : sert les pages CMS directement à la racine (/cv, /a-propos, /adrar…).
// Placé après les routes statiques connues — TanStack Router priorise les chemins exacts sur les params.
const pageSlugRoute = createRoute({ getParentRoute: () => publicRoute, path: '/$slug', component: PageView });
const shopRoute = createRoute({ getParentRoute: () => publicRoute, path: '/shop', component: ShopGuarded });
const productViewRoute = createRoute({ getParentRoute: () => publicRoute, path: '/products/$slug', component: ProductGuarded });
const devisRoute = createRoute({ getParentRoute: () => publicRoute, path: '/devis/$slug', component: DevisGuarded });
const devisThanksRoute = createRoute({ getParentRoute: () => publicRoute, path: '/devis/$slug/merci', component: DevisThanksGuarded });
const cartRoute = createRoute({ getParentRoute: () => publicRoute, path: '/cart', component: CartGuarded });
const checkoutRoute = createRoute({ getParentRoute: () => publicRoute, path: '/checkout', component: CheckoutGuarded });
const checkoutSuccessRoute = createRoute({ getParentRoute: () => publicRoute, path: '/checkout/success', component: CheckoutSuccessGuarded });
const accountRoute = createRoute({ getParentRoute: () => publicRoute, path: '/account', component: AccountGuarded });
const accountLoginRoute = createRoute({ getParentRoute: () => publicRoute, path: '/account/login', component: AccountLoginGuarded });
const accountRegisterRoute = createRoute({ getParentRoute: () => publicRoute, path: '/account/register', component: AccountRegisterGuarded });
const accountCloudRoute = createRoute({ getParentRoute: () => publicRoute, path: '/account/cloud', component: CloudGuarded });
const formViewRoute = createRoute({ getParentRoute: () => publicRoute, path: '/f/$slug', component: FormGuarded });
const agendaRoute = createRoute({ getParentRoute: () => publicRoute, path: '/agenda', component: AgendaGuarded });
const eventViewRoute = createRoute({ getParentRoute: () => publicRoute, path: '/agenda/$slug', component: EventViewGuarded });
const blogRoute = createRoute({ getParentRoute: () => publicRoute, path: '/blog', component: BlogGuarded });
const categoryRoute = createRoute({ getParentRoute: () => publicRoute, path: '/blog/categorie/$cat', component: CategoryGuarded });
const postViewRoute = createRoute({ getParentRoute: () => publicRoute, path: '/blog/$slug', component: PostViewGuarded });
const searchRoute = createRoute({ getParentRoute: () => publicRoute, path: '/recherche', component: SearchPage });
const planningPublicRoute = createRoute({ getParentRoute: () => publicRoute, path: '/planning', component: PlanningGuarded });
const forumPublicRoute = createRoute({ getParentRoute: () => publicRoute, path: '/forum', component: ForumGuarded });
const forumCatRoute = createRoute({ getParentRoute: () => publicRoute, path: '/forum/c/$cat', component: ForumCatGuarded });
const forumTopicRoute = createRoute({ getParentRoute: () => publicRoute, path: '/forum/sujet/$slug', component: ForumTopicGuarded });

const routeTree = rootRoute.addChildren([
  loginRoute,
  adminRoute.addChildren([
    dashRoute,
    featuresRoute,
    themeRoute,
    performanceRoute,
    backupRoute,
    mediaRoute,
    notesRoute,
    emailRoute,
    newsletterRoute,
    templatesRoute, templateNewRoute, templateEditRoute,
    pagesRoute, pageNewRoute, pageEditRoute,
    productsRoute, productNewRoute, productEditRoute,
    ordersRoute, orderDetailRoute,
    menusRoute, menuNewRoute, menuEditRoute,
    couponsRoute, couponNewRoute, couponEditRoute,
    shippingRoute, shippingNewRoute, shippingEditRoute,
    quoteFormsRoute, quoteFormNewRoute, quoteFormEditRoute,
    quoteSubsRoute, quoteSubDetailRoute,
    formsRoute, formNewRoute, formEditRoute, formResultsRoute,
    eventsRoute, eventNewRoute, eventEditRoute,
    postsRoute, postNewRoute, postEditRoute, commentsRoute,
    planningsRoute, planningNewRoute, planningEditRoute,
    forumAdminRoute,
  ]),
  publicRoute.addChildren([
    homeRoute,
    pageViewRoute,
    shopRoute, productViewRoute,
    devisRoute, devisThanksRoute,
    cartRoute, checkoutRoute, checkoutSuccessRoute,
    accountRoute, accountLoginRoute, accountRegisterRoute, accountCloudRoute,
    formViewRoute,
    agendaRoute, eventViewRoute,
    blogRoute, categoryRoute, postViewRoute,
    searchRoute,
    planningPublicRoute,
    forumPublicRoute, forumCatRoute, forumTopicRoute,
    pageSlugRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
